import fetch from 'node-fetch';

const TARGET_URL = "https://roombook.fas.harvard.edu/athletics/EmsWebApp/AnonymousServersApi.aspx/CustomBrowseEvents";

async function testApi(format) {
  const payload = {
    date: `2026-03-01 00:00:00`,
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
      "Format": format,
      "Rollup": 1,
      "PageSize": 50,
      "DropEventsInPast": false,
      "EncryptD": "https://roombook.fas.harvard.edu/athletics/EmsWebApp/CustomBrowseEvents.aspx?data=CUAlBT1V4ZoexsVzSloGUXzhWPpritZXU8XlMnNI9%2f%2f8yJVumS%2f0HTdV7IdKgmumdP7c74Ed8w1xws0ZRrZ6IgjV78en6NzQW9JnC2AnAFF20Bq3X0JGfpCq6QBQeujeB6S4f0zWRYMF7Pc4c5rzVXwYmjy1eednpX8QS%2bXLRTGYnKiqGTLz9w%3d%3d"
    }
  };

  const response = await fetch(TARGET_URL, {
    method: 'POST',
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
      "Content-Type": "application/json; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest"
    },
    body: JSON.stringify(payload)
  });

  const jsonResponse = await response.json();
  const parsedData = JSON.parse(jsonResponse.d);
  console.log(`Format ${format} keys:`, Object.keys(parsedData));
  if (parsedData.MonthlyBookingResults) {
      console.log(`Format ${format} MonthlyBookingResults count:`, parsedData.MonthlyBookingResults.length);
      const multiple = parsedData.MonthlyBookingResults.filter(r => r.Location && r.Location.includes('Multiple'));
      console.log(`Format ${format} 'Multiple' locations:`, multiple.length);
      if (multiple.length > 0) {
          console.log(multiple[0]);
      }
  }
  if (parsedData.WeeklyBookingResults) {
      console.log(`Format ${format} WeeklyBookingResults count:`, parsedData.WeeklyBookingResults.length);
  }
  if (parsedData.DailyBookingResults) {
      console.log(`Format ${format} DailyBookingResults count:`, parsedData.DailyBookingResults.length);
  }
}

async function run() {
  await testApi(0); // Daily?
  await testApi(1); // Weekly?
  await testApi(2); // Monthly
}

run();
