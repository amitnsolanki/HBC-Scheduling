const TARGET_URL = "https://roombook.fas.harvard.edu/athletics/EmsWebApp/AnonymousServersApi.aspx/CustomBrowseEvents";
const payload = {
  date: "2026-03-01 00:00:00",
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
    "Rollup": 1,
    "PageSize": 50,
    "DropEventsInPast": false, // Don't drop past events so we can see the whole month
    "EncryptD": "https://roombook.fas.harvard.edu/athletics/EmsWebApp/CustomBrowseEvents.aspx?data=CUAlBT1V4ZoexsVzSloGUXzhWPpritZXU8XlMnNI9%2f%2f8yJVumS%2f0HTdV7IdKgmumdP7c74Ed8w1xws0ZRrZ6IgjV78en6NzQW9JnC2AnAFF20Bq3X0JGfpCq6QBQeujeB6S4f0zWRYMF7Pc4c5rzVXwYmjy1eednpX8QS%2bXLRTGYnKiqGTLz9w%3d%3d"
  }
};

fetch(TARGET_URL, {
  method: 'POST',
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest"
  },
  body: JSON.stringify(payload)
}).then(res => res.json()).then(json => {
  const parsed = JSON.parse(json.d);
  const results = parsed.MonthlyBookingResults;
  const cancelledEvents = results.filter(r => r.StatusId === 3 || r.StatusTypeId === -12);
  console.log("Cancelled events count:", cancelledEvents.length);
  if (cancelledEvents.length > 0) {
    console.log("First cancelled event:", cancelledEvents[0].EventName, cancelledEvents[0].StatusId, cancelledEvents[0].StatusTypeId);
  }
});
