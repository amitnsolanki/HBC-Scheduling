import fetch from 'node-fetch';

const TARGET_URL = "https://roombook.fas.harvard.edu/athletics/EmsWebApp/AnonymousServersApi.aspx/CustomBrowseEvents";

async function testApi() {
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
      "Format": 2,
      "Rollup": 0,
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
  
  const sundayEvents = parsedData.MonthlyBookingResults.filter(e => e.EventStart.includes('2026-03-01') && e.EventName.includes('Badminton'));
  
  sundayEvents.forEach(e => {
      console.log(`- ${e.EventName} at ${e.Location} (Id: ${e.Id}, ReservationId: ${e.ReservationId})`);
  });
}

testApi();
