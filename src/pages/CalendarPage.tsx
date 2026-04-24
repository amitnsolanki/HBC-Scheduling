import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, addDays, subWeeks, addWeeks, parseISO, isSameDay, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, CalendarPlus, User } from 'lucide-react';
import { BookingResult, Signup, UserProfile } from '../types';
import EventModal from '../components/EventModal';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';

export default function CalendarPage() {
  const [data, setData] = useState<BookingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [fetchedMonths, setFetchedMonths] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<BookingResult | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
  const endDate = addDays(startDate, 6);
  
  const startMonthStr = format(startDate, 'yyyy-MM');
  const endMonthStr = format(endDate, 'yyyy-MM');

  const fetchMonthData = async (monthStr: string, force: boolean = false) => {
    if (!force && fetchedMonths.has(monthStr)) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/schedule?date=${monthStr}-01${force ? '&force=true' : ''}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch schedule data for ${monthStr}`);
      }
      const jsonData = await response.json();
      
      setData(prevData => {
        // If forcing a refresh, we should probably clear out the old data for this month
        // but for simplicity, we'll just merge and deduplicate
        const newData = force ? jsonData : [...prevData, ...jsonData];
        const uniqueData = Array.from(new Map(newData.map((item: BookingResult) => [item.Id, item])).values());
        return uniqueData as BookingResult[];
      });
      
      setFetchedMonths(prev => new Set(prev).add(monthStr));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthData(startMonthStr);
    if (startMonthStr !== endMonthStr) {
      fetchMonthData(endMonthStr);
    }
  }, [startMonthStr, endMonthStr, fetchedMonths]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'signups'), (snapshot) => {
      const data: Signup[] = [];
      snapshot.docs.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Signup);
      });
      setSignups(data);
    }, (error) => {
      console.error('Error fetching signups:', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchProfiles = async () => {
      const uids: string[] = Array.from(new Set(signups.map(s => s.uid)));
      const profiles: Record<string, UserProfile> = { ...userProfiles };
      let fetched = false;
      for (const uid of uids) {
        if (!profiles[uid]) {
          try {
            const d = await getDoc(doc(db, 'users', uid));
            if (d.exists()) {
              profiles[uid] = d.data() as UserProfile;
              fetched = true;
            }
          } catch (e) {}
        }
      }
      if (fetched) {
        setUserProfiles(profiles);
      }
    };
    if (signups.length > 0) {
      fetchProfiles();
    }
  }, [signups]);

  const handleExportCalendar = () => {
    if (!currentUser) {
      alert("Please sign in to export your calendar.");
      return;
    }
    
    const mySignups = signups.filter(s => s.uid === currentUser.uid);
    const myEvents = data.filter(e => mySignups.some(s => String(s.eventId) === String(e.Id)));
    
    if (myEvents.length === 0) {
      alert("No signed-up sessions found in the currently loaded schedule. Navigate to the month of your sessions first.");
      return;
    }

    const formatDates = (dateStr: string) => dateStr.replace(/[-:]/g, '');
  
    let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//HBC Club//EN\n';
    myEvents.forEach(e => {
      ics += 'BEGIN:VEVENT\n';
      ics += `UID:${e.Id}@hbcclub.app\n`;
      ics += `DTSTAMP:${formatDates(new Date().toISOString().split('.')[0] + 'Z')}\n`;
      ics += `DTSTART:${formatDates(e.EventStart.split('.')[0])}\n`;
      ics += `DTEND:${formatDates(e.EventEnd.split('.')[0])}\n`;
      ics += `SUMMARY:${e.EventName}\n`;
      ics += `LOCATION:${e.Location}\n`;
      ics += 'END:VEVENT\n';
    });
    ics += 'END:VCALENDAR';

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hbc_sessions.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const badmintonEvents = useMemo(() => {
    return data.filter(event => {
      if (!event.EventName) return false;
      const name = event.EventName.toLowerCase();
      const loc = (event.Location || '').toLowerCase();
      
      // Filter out Court 2 and Mezzanine if they are the only locations
      const hasCourt1 = loc.includes('court 1') || loc.includes('basketball 1');
      const hasCourt3 = loc.includes('court 3') || loc.includes('basketball 3');
      
      if (!hasCourt1 && !hasCourt3 && (loc.includes('court 2') || loc.includes('basketball 2') || loc.includes('mezzanine'))) {
        return false;
      }
      
      return name.includes('badminton') || name.includes('flex rec');
    });
  }, [data]);

  const { minStartHour, maxEndHour } = useMemo(() => {
    let minH = 24;
    let maxH = 0;
    badmintonEvents.forEach(e => {
      const s = parseISO(e.EventStart);
      const eTime = parseISO(e.EventEnd);
      if (s.getHours() < minH) minH = s.getHours();
      if (eTime.getHours() > maxH) maxH = eTime.getHours();
    });
    // Default to 8am-10pm if no events, otherwise add a buffer
    if (minH === 24) return { minStartHour: 8, maxEndHour: 22 };
    return { minStartHour: Math.max(0, minH - 1), maxEndHour: Math.min(23, maxH + 1) };
  }, [badmintonEvents]);

  const totalRows = (maxEndHour - minStartHour) * 4;

  const dateRangeString = useMemo(() => {
    const startStr = format(startDate, 'MMM d');
    const endStr = format(endDate, isSameMonth(startDate, endDate) ? 'd, yyyy' : 'MMM d, yyyy');
    return `${startStr} - ${endStr}`;
  }, [startDate, endDate]);

  const compactDateRange = useMemo(() => {
    if (isSameMonth(startDate, endDate)) {
      return `${format(startDate, 'd')}-${format(endDate, 'do MMM yy')}`;
    }
    return `${format(startDate, 'd MMM')}-${format(endDate, 'do MMM yy')}`;
  }, [startDate, endDate]);

  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  const renderEventCard = (event: BookingResult, j: number, showLocation: boolean = false) => {
    const isCancelled = event.StatusTypeId === -12;
    const isFlexRec = event.EventName.toLowerCase().includes('flex rec');
    const isPast = new Date(event.GmtEnd + 'Z') < new Date();
    
    let bgClass = 'bg-red-50 border-red-100 hover:border-red-300';
    let textClass = 'text-red-900';
    let timeClass = 'text-red-700';
    
    if (isCancelled) {
      bgClass = 'bg-slate-50 border-slate-200 opacity-75';
      textClass = 'text-slate-700 line-through';
      timeClass = 'text-slate-500';
    } else if (isFlexRec) {
      bgClass = 'bg-green-50 border-green-200 hover:border-green-300';
      textClass = 'text-green-900';
      timeClass = 'text-green-700';
    }

    if (isPast && !isCancelled) {
      bgClass += ' opacity-50 grayscale';
    }

    const simplifyLocation = (loc: string) => {
      if (!loc) return 'Unknown';
      const courts = [];
      if (loc.includes('Basketball 1') || loc.includes('Court 1')) courts.push('Court 1');
      if (loc.includes('Basketball 2') || loc.includes('Court 2')) courts.push('Court 2');
      if (loc.includes('Basketball 3') || loc.includes('Court 3')) courts.push('Court 3');
      
      if (courts.length > 0) return courts.join(' & ');
      return loc.replace('MalkinAthleticCenter - MAC Basketball ', '').replace('MalkinAthleticCenter - ', '');
    };

    const formatEventName = (name: string) => {
      return name
        .replace(/Badminton/ig, '🏸')
        .replace(/Practice/ig, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const signupCount = signups.filter(s => String(s.eventId) === String(event.Id)).length;

    return (
      <div 
        key={event.Id || j} 
        onClick={() => !isFlexRec && setSelectedEvent(event)}
        className={`border rounded-md p-1.5 text-xs transition-shadow group relative ${isFlexRec ? 'cursor-default' : 'cursor-pointer hover:shadow-sm'} ${bgClass}`}
      >
        <div className={`font-semibold mb-0.5 leading-tight text-[10px] md:text-[11px] ${textClass}`}>
          {isCancelled ? '(CANCELLED) ' : ''}{formatEventName(event.EventName)}
        </div>
        <div className={`font-medium text-[9px] md:text-[10px] ${timeClass} ${showLocation ? 'mb-0.5' : ''}`}>
          {format(parseISO(event.EventStart), 'h:mma').toLowerCase().replace('m', '')} - {format(parseISO(event.EventEnd), 'h:mma').toLowerCase().replace('m', '')}
        </div>
        {showLocation && (
          <div className="text-slate-600 text-[9px] truncate" title={event.Location}>
            📍 {simplifyLocation(event.Location)}
          </div>
        )}
        {!isCancelled && !isFlexRec && (() => {
          const eventSignups = signups.filter(s => String(s.eventId) === String(event.Id));
          const maleCount = eventSignups.filter(s => (userProfiles[s.uid]?.gender || 'Male') === 'Male').length;
          const femaleCount = eventSignups.filter(s => userProfiles[s.uid]?.gender === 'Female').length;
          
          console.log(`Event ${event.Id}: Total Signups=${eventSignups.length}, M=${maleCount}, F=${femaleCount}`);
          
          if (eventSignups.length === 0) return null;
          
          return (
            <div className="mt-1.5 flex justify-end items-center text-[10px] font-semibold text-slate-700 gap-1.5 bg-white/50 rounded px-1 py-0.5">
              {maleCount > 0 && <span>👨 {maleCount}</span>}
              {femaleCount > 0 && <span>👩 {femaleCount}</span>}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Schedule</h2>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 no-scrollbar mb-2 sm:mb-0">
          <button
            onClick={handleExportCalendar}
            className="flex-shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1 sm:gap-1.5 shadow-sm"
            title="Export My Sessions to Calendar"
          >
            <CalendarPlus size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide">Export</span>
          </button>
          
          <button
            onClick={() => setCurrentDate(new Date())}
            className="flex-shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
          >
            Today
          </button>
          
          <div className="flex-shrink-0 flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm ml-auto sm:ml-0">
            <button 
              onClick={handlePrevWeek}
              className="p-1 sm:p-1.5 rounded-md hover:bg-slate-100 transition-all text-slate-600 hover:text-slate-900"
              aria-label="Previous Week"
            >
              <ChevronLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            <span className="px-2 text-[11px] sm:text-sm font-bold min-w-[90px] sm:min-w-[160px] text-center text-slate-700 whitespace-nowrap">
              <span className="sm:hidden">{compactDateRange}</span>
              <span className="hidden sm:inline">{dateRangeString}</span>
            </span>
            <button 
              onClick={handleNextWeek}
              className="p-1 sm:p-1.5 rounded-md hover:bg-slate-100 transition-all text-slate-600 hover:text-slate-900"
              aria-label="Next Week"
            >
              <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="animate-spin text-red-700" size={32} />
          <p className="text-slate-500 font-medium">Loading schedule data...</p>
        </div>
      ) : error && data.length === 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col items-center justify-center text-center max-w-lg mx-auto mt-12">
          <AlertCircle className="text-red-600 mb-3" size={32} />
          <h3 className="text-lg font-semibold text-red-900 mb-1">Failed to load schedule</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col md:grid md:grid-cols-7 md:divide-x divide-y md:divide-y-0 divide-slate-200 min-h-[500px]">
            {weekDays.map((day, i) => {
              let dayEvents = badmintonEvents.filter(event => {
                try {
                  const eventDate = parseISO(event.EventStart);
                  return isSameDay(eventDate, day);
                } catch (e) {
                  return false;
                }
              });

              // Merge Sunday Club sessions
              if (day.getDay() === 0) {
                const clubEvents = dayEvents.filter(e => e.EventName.toLowerCase().includes('club'));
                if (clubEvents.length > 1) {
                  const mergedEvent = {
                    ...clubEvents[0],
                    EventStart: clubEvents.reduce((min, e) => e.EventStart < min ? e.EventStart : min, clubEvents[0].EventStart),
                    EventEnd: clubEvents.reduce((max, e) => e.EventEnd > max ? e.EventEnd : max, clubEvents[0].EventEnd),
                    Location: 'Multiple Courts'
                  };
                  dayEvents = [...dayEvents.filter(e => !e.EventName.toLowerCase().includes('club')), mergedEvent];
                }
              }

              dayEvents.sort((a, b) => {
                return new Date(a.EventStart).getTime() - new Date(b.EventStart).getTime();
              });

              return (
                <div key={i} className="flex flex-col bg-white">
                  <div className="md:hidden bg-slate-100/80 border-b border-slate-200 p-3 flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{format(day, 'EEEE, MMM d')}</span>
                    {isSameDay(day, new Date()) && (
                      <span className="bg-red-700 text-white text-xs px-2.5 py-1 rounded-full font-medium tracking-wide shadow-sm">Today</span>
                    )}
                  </div>

                  <div className="hidden md:block py-4 px-3 text-center border-b border-slate-200 bg-slate-50/50">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-lg font-medium ${isSameDay(day, new Date()) ? 'bg-red-700 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : 'text-slate-900'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col">
                    {dayEvents.length === 0 ? (
                      <div className="h-24 md:h-full flex items-center justify-center p-4 text-center">
                        <span className="text-xs text-slate-400 italic">No events</span>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col h-full">
                        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center divide-x divide-slate-200">
                          <div className="py-1">Court 1</div>
                          <div className="py-1">Court 3</div>
                        </div>
                        <div className="flex-1 grid grid-cols-2 divide-x divide-slate-200">
                          <div className="flex flex-col gap-1 p-1">
                            {dayEvents.filter(e => e.Location?.includes('Basketball 1') || e.Location?.includes('Court 1')).map((event, j) => (
                              <div key={j}>
                                {renderEventCard(event, j, false)}
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col gap-1 p-1">
                            {dayEvents.filter(e => e.Location?.includes('Basketball 3') || e.Location?.includes('Court 3')).map((event, j) => (
                              <div key={j}>
                                {renderEventCard(event, j, false)}
                              </div>
                            ))}
                          </div>
                        </div>
                        {(() => {
                          const otherEvents = dayEvents.filter(e => !(e.Location?.includes('Basketball 1') || e.Location?.includes('Court 1')) && !(e.Location?.includes('Basketball 3') || e.Location?.includes('Court 3')));
                          if (otherEvents.length === 0) return null;
                          return (
                            <div className="p-1 md:p-1.5 border-t border-slate-200 flex flex-col gap-1.5 bg-slate-50/30">
                              <div className="text-[9px] font-semibold text-slate-400 uppercase text-center mb-0.5">Other</div>
                              {otherEvents.map((event, j) => renderEventCard(event, j, true))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedEvent && (
        <EventModal 
          event={selectedEvent} 
          onClose={() => setSelectedEvent(null)} 
        />
      )}
    </div>
  );
}
