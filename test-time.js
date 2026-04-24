import { parseISO } from 'date-fns';

const events = [
  { EventStart: '2026-03-01T10:00:00', EventEnd: '2026-03-01T12:00:00' },
  { EventStart: '2026-03-01T18:30:00', EventEnd: '2026-03-01T20:30:00' }
];

events.forEach(e => {
  const start = parseISO(e.EventStart);
  const end = parseISO(e.EventEnd);
  console.log(`Start: ${start.getHours()}:${start.getMinutes()}, End: ${end.getHours()}:${end.getMinutes()}`);
});
