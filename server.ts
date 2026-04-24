import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json());
const PORT = 3000;

// Initialize Firebase for server-side caching
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const TARGET_URL = "https://roombook.fas.harvard.edu/athletics/EmsWebApp/AnonymousServersApi.aspx/CustomBrowseEvents";

async function fetchHarvardData(monthKey: string) {
  console.log(`Fetching fresh data for ${monthKey} from Harvard server...`);
  const payload = {
    date: `${monthKey}-01 00:00:00`,
    data: {
      "BuildingId": 81,
      "GroupTypeId": -1,
      "GroupId": -1,
      "EventTypeId": -1,
      "RoomId": -1,
      "StatusId": -1,
      "ZeroDisplayOnWeb": 0,
      "HeaderUrl": "",
      "Title": "MAC Gym Floor ",
      "Format": 2, // 2 = Monthly
      "Rollup": 0,
      "PageSize": 50,
      "DropEventsInPast": false,
      "EncryptD": "https://roombook.fas.harvard.edu/athletics/EmsWebApp/CustomBrowseEvents.aspx?data=CUAlBT1V4ZoexsVzSloGUXzhWPpritZXU8XlMnNI9%2f%2f8yJVumS%2f0HTdV7IdKgmumdP7c74Ed8w1xws0ZRrZ6IgjV78en6NzQW9JnC2AnAFF20Bq3X0JGfpCq6QBQeujeB6S4f0zWRYMF7Pc4c5rzVXwYmjy1eednpX8QS%2bXLRTGYnKiqGTLz9w%3d%3d"
    }
  };

  const response = await fetch(TARGET_URL, {
    method: 'POST',
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/json; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }

  const jsonResponse = await response.json();
  if (!jsonResponse.d) throw new Error("Invalid API response format: missing 'd' property");

  const parsedData = JSON.parse(jsonResponse.d);
  if (!parsedData.MonthlyBookingResults) throw new Error("MonthlyBookingResults not found in parsed data");

  const results = parsedData.MonthlyBookingResults;
  
  // Group by ReservationId + EventStart to combine locations for the same session
  const groupedResults = new Map();
  for (const event of results) {
    const key = `${event.ReservationId}_${event.EventStart}`;
    if (groupedResults.has(key)) {
      const existing = groupedResults.get(key);
      if (!existing.Location.includes(event.Location)) {
        existing.Location += `, ${event.Location}`;
      }
    } else {
      groupedResults.set(key, { ...event });
    }
  }
  
  const finalResults = Array.from(groupedResults.values());

  try {
    await setDoc(doc(db, "schedule_cache", monthKey), {
      data: finalResults,
      timestamp: Date.now()
    });
    console.log(`Saved ${monthKey} to Firestore cache.`);
  } catch (err) {
    console.error("Failed to save to Firestore:", err);
  }

  return finalResults;
}

app.get("/api/schedule", async (req, res) => {
  try {
    const dateParam = req.query.date as string || new Date().toISOString().split('T')[0];
    const forceRefresh = req.query.force === 'true';
    const monthKey = dateParam.substring(0, 7); // YYYY-MM

    // Check Firestore cache unless forceRefresh is requested
    if (!forceRefresh) {
      try {
        const docSnap = await getDoc(doc(db, "schedule_cache", monthKey));
        if (docSnap.exists()) {
          console.log(`Serving ${monthKey} from Firestore cache`);
          return res.json(docSnap.data().data);
        }
      } catch (err) {
        console.error("Firestore cache read error:", err);
      }
    }

    const results = await fetchHarvardData(monthKey);
    res.json(results);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    res.status(500).json({ error: "Failed to fetch schedule data" });
  }
});

app.post("/api/notify", async (req, res) => {
  const { to, subject, text, html, recipientUid, senderName, messageText } = req.body;

  let recipientEmail = to;
  let emailSubject = subject;
  let emailText = text;
  let emailHtml = html;

  // Handle formatted notifications (like chat messages)
  if (recipientUid && senderName && messageText) {
    try {
      const userDoc = await getDoc(doc(db, "users", recipientUid));
      if (userDoc.exists()) {
        const profile = userDoc.data();
        recipientEmail = profile.email || recipientEmail;
      }

      // Fallback: If still no email, check their latest signups
      if (!recipientEmail) {
        const signupsRef = collection(db, "signups");
        const q = query(signupsRef, where("uid", "==", recipientUid), limit(1));
        const signupDocs = await getDocs(q);
        if (!signupDocs.empty) {
          const signupData = signupDocs.docs[0].data();
          recipientEmail = signupData.email;
        }
      }

      if (recipientEmail) {
        emailSubject = `New message from ${senderName} on HBC Club`;
        emailText = `${senderName} sent you a message:\n\n"${messageText}"\n\nReply at: ${process.env.APP_URL || 'the website'}`;
        emailHtml = `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #e11d48;">New Message</h2>
            <p><strong>${senderName}</strong> sent you a message on HBC Club:</p>
            <div style="background: #f1f5f9; padding: 15px; border-radius: 10px; margin: 20px 0; font-style: italic;">
              "${messageText}"
            </div>
            <a href="${process.env.APP_URL || req.hostname}" style="background: #e11d48; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block;">
              View and Reply
            </a>
          </div>
        `;
      }
    } catch (err) {
      console.error("Failed to fetch recipient profile/signup for notification:", err);
    }
  }

  if (!recipientEmail) {
    // Gracefully handle users that haven't registered/synced their emails yet
    return res.status(200).json({ success: true, message: "Recipient has no email address on file, skipped email notification." });
  }

  if (!emailSubject || (!emailText && !emailHtml)) {
    return res.status(400).json({ error: "Missing required notification info (body or subject)." });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"HBC Club" <noreply@${req.hostname}>`,
      to: recipientEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });

    console.log("Message sent: %s", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email notification" });
  }
});

const notifiedSignups = new Set<string>();

async function startSignupReminderJob() {
  console.log("Starting signup reminder cron job...");
  
  // Check every 1 minute
  setInterval(async () => {
    try {
      const now = Date.now();
      const cutoffRange = now + 40 * 60 * 1000; // Looking ahead 40 mins

      const signupsRef = collection(db, "signups");
      // Since unauthenticated server cannot write, we only read and keep state in memory
      const q = query(signupsRef, 
        where("arrivalDateTimeMillis", ">=", now), 
        where("arrivalDateTimeMillis", "<=", cutoffRange)
      );

      const querySnapshot = await getDocs(q);
      
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      for (const docSnap of querySnapshot.docs) {
        const id = docSnap.id;
        if (notifiedSignups.has(id)) continue;

        const data = docSnap.data();
        if (!data.email || !data.createdAt || !data.arrivalDateTimeMillis) continue;

        const creationTime = data.createdAt.toMillis ? data.createdAt.toMillis() : Date.parse(data.createdAt);
        const arrivalTimeMillis = data.arrivalDateTimeMillis;
        
        const leadTime = arrivalTimeMillis - creationTime;
        const timeRemaining = arrivalTimeMillis - now;

        // "if some one booked less than 30mins from start time don't send any email notifications"
        if (leadTime < 30 * 60 * 1000) {
          notifiedSignups.add(id); // Mark as processed (skipped)
          continue;
        }

        // "instead only notify 30mins before their session time"
        if (timeRemaining <= 30 * 60 * 1000 && timeRemaining > 0) {
          notifiedSignups.add(id);
          
          try {
            await transporter.sendMail({
              from: process.env.SMTP_FROM || `"HBC Club" <noreply@hbc.com>`,
              to: data.email,
              subject: `Reminder: Badminton Session at ${data.arrivalTime}`,
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #e11d48;">Session Reminder</h2>
                  <p>Hello ${data.name || 'Player'},</p>
                  <p>This is a quick reminder that your badminton session is starting in 30 minutes!</p>
                  <div style="background: #f1f5f9; padding: 15px; border-left: 4px solid #e11d48; border-radius: 4px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>Arrival Time:</strong> ${data.arrivalTime}</p>
                    <p style="margin: 0 0 0 0;"><strong>Duration:</strong> ${data.duration}</p>
                  </div>
                  <p>See you on the court soon!</p>
                </div>
              `
            });
            console.log(`Sent 30-min reminder to ${data.email} for signup ${id}`);
          } catch (e) {
            console.error(`Failed to send reminder to ${data.email}:`, e);
          }
        }
      }
    } catch (err) {
      console.error("Error in signup reminder job:", err);
    }
  }, 60 * 1000);
}

async function startServer() {
  startSignupReminderJob();
  
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
