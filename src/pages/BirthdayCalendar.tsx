import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamilyStore } from '@/store/familyStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Cake, TrendingUp, Users } from 'lucide-react';
import {
    getUpcomingBirthdays,
    getBirthdaysByMonth,
    getMonthOnlyBirthdays,
    getBirthdayTwins,
    getBirthdayStats,
    formatCountdown
} from '@/lib/birthdayUtils';
import { formatFlexibleDate } from '@/lib/flexibleDateUtils';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { usePagination } from '@/components/VirtualList';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function BirthdayCalendar() {
    const { persons, setSelectedPerson } = useFamilyStore();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    // Get upcoming birthdays with pagination
    const allUpcomingBirthdays = useMemo(() => getUpcomingBirthdays(persons, 50), [persons]);
    const {
        visibleItems: upcomingBirthdays,
        hasMore,
        hasPrev,
        nextPage,
        prevPage,
        currentPage,
        totalPages,
        startIndex,
        endIndex
    } = usePagination(allUpcomingBirthdays, 5);

    // Get birthdays for selected month
    const monthBirthdays = useMemo(() =>
        getBirthdaysByMonth(persons, selectedMonth, selectedYear),
        [persons, selectedMonth, selectedYear]
    );

    const monthOnlyBirthdays = useMemo(() =>
        getMonthOnlyBirthdays(persons, selectedMonth),
        [persons, selectedMonth]
    );

    // Get statistics
    const stats = useMemo(() => getBirthdayStats(persons), [persons]);
    const birthdayTwins = useMemo(() => getBirthdayTwins(persons), [persons]);

    // Calendar grid generator
    const calendarDays = useMemo(() => {
        const firstDay = new Date(selectedYear, selectedMonth, 1);
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days: (number | null)[] = [];

        // Add empty slots for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add actual days
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }

        return days;
    }, [selectedMonth, selectedYear]);

    const goToPreviousMonth = () => {
        if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear(selectedYear - 1);
        } else {
            setSelectedMonth(selectedMonth - 1);
        }
    };

    const goToNextMonth = () => {
        if (selectedMonth === 11) {
            setSelectedMonth(0);
            setSelectedYear(selectedYear + 1);
        } else {
            setSelectedMonth(selectedMonth + 1);
        }
    };

    const goToToday = () => {
        const now = new Date(); // Get fresh date
        setSelectedMonth(now.getMonth());
        setSelectedYear(now.getFullYear());
    };

    // Get birthdays for a specific day
    const getBirthdaysForDay = (day: number) => {
        const dayData = monthBirthdays.find(b => b.day === day);
        return dayData?.persons || [];
    };

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <Cake className="w-7 h-7 text-primary shrink-0" />
                    <h1 className="text-2xl sm:text-3xl font-display font-bold">Kalender Ulang Tahun</h1>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'} gap-5 sm:gap-6`}>

                {/* Left Column: Upcoming Birthdays */}
                <Card className="p-4 sm:p-6 rounded-2xl lg:col-span-1">
                    <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-primary" />
                        Ulang Tahun Terdekat
                    </h2>

                    {upcomingBirthdays.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Tidak ada data tanggal lahir</p>
                    ) : (
                        <div className="space-y-2.5">
                            {upcomingBirthdays.map((birthday) => (
                                <div
                                    key={birthday.person.id}
                                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-colors cursor-pointer"
                                    onClick={() => {
                                        setSelectedPerson(birthday.person.id);
                                        navigate(`/chart?focus=${birthday.person.id}`);
                                    }}
                                >
                                    {/* Age Badge */}
                                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-base font-bold text-primary">
                                            {birthday.ageOnNextBirthday !== null
                                                ? `${birthday.isApproximateAge ? '~' : ''}${birthday.ageOnNextBirthday}`
                                                : '🎂'}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold truncate">{birthday.person.fullName}</p>
                                            {birthday.isToday && (
                                                <Badge variant="default" className="bg-green-500 animate-pulse">
                                                    🎉 Hari Ini!
                                                </Badge>
                                            )}
                                            {birthday.isTomorrow && (
                                                <Badge variant="secondary">Besok</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {formatCountdown(birthday.daysUntil)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {allUpcomingBirthdays.length > 5 && (
                        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={prevPage}
                                disabled={!hasPrev}
                                className="gap-1"
                            >
                                <ChevronLeft className="w-3 h-3" />
                                Prev
                            </Button>

                            <span className="text-xs text-muted-foreground">
                                {startIndex}-{endIndex} dari {allUpcomingBirthdays.length}
                            </span>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={nextPage}
                                disabled={!hasMore}
                                className="gap-1"
                            >
                                Next
                                <ChevronRight className="w-3 h-3" />
                            </Button>
                        </div>
                    )}
                </Card>

                {/* Right Column: Calendar View + Stats */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Calendar */}
                    <Card className="p-4 sm:p-6 rounded-2xl">
                        {/* Calendar Header */}
                        <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
                            <h2 className="text-lg sm:text-2xl font-display font-bold">
                                {MONTH_NAMES[selectedMonth]} {selectedYear}
                            </h2>
                            <div className="flex items-center gap-1.5 sm:gap-2">
                                <Button variant="outline" size="sm" onClick={goToToday} className="h-8 text-xs">
                                    Hari Ini
                                </Button>
                                <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="h-8 w-8">
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-8 w-8">
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2">
                            {/* Day headers */}
                            {DAY_NAMES.map(day => (
                                <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                                    {day}
                                </div>
                            ))}

                            {/* Calendar days */}
                            {calendarDays.map((day, idx) => {
                                if (day === null) {
                                    return <div key={`empty-${idx}`} className="aspect-square" />;
                                }

                                const birthdays = getBirthdaysForDay(day);
                                const isToday = day === today.getDate() &&
                                    selectedMonth === today.getMonth() &&
                                    selectedYear === today.getFullYear();

                                return (
                                    <div
                                        key={day}
                                        className={`
                                            aspect-square p-2 rounded-lg border-2 transition-all relative
                                            ${isToday ? 'border-primary bg-primary/10' : 'border-border'}
                                            ${birthdays.length > 0 ? 'bg-accent/30' : 'hover:bg-accent/10'}
                                            cursor-pointer
                                        `}
                                    >
                                        <div className="text-sm font-medium">{day}</div>
                                        {birthdays.length > 0 && (
                                            <div className="absolute bottom-1 left-1 right-1">
                                                {birthdays.slice(0, 2).map(person => (
                                                    <div
                                                        key={person.id}
                                                        className="text-[10px] truncate text-primary bg-primary/20 rounded px-1"
                                                        title={person.fullName}
                                                    >
                                                        {person.fullName.split(' ')[0]}
                                                    </div>
                                                ))}
                                                {birthdays.length > 2 && (
                                                    <div className="text-[9px] text-muted-foreground">
                                                        +{birthdays.length - 2} lagi
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {monthOnlyBirthdays.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-border/60">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Lahir di bulan {MONTH_NAMES[selectedMonth]} (tanggal pasti tidak diketahui):
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {monthOnlyBirthdays.map((p) => (
                                        <Badge
                                            key={p.id}
                                            variant="secondary"
                                            className="cursor-pointer text-xs font-normal hover:bg-primary/15"
                                            onClick={() => {
                                                setSelectedPerson(p.id);
                                                navigate(`/chart?focus=${p.id}`);
                                            }}
                                        >
                                            {p.fullName} ({formatFlexibleDate(p.birthDate)})
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="w-8 h-8 text-blue-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Bulan Terbanyak</p>
                                    <p className="text-lg font-bold">{stats.mostCommonMonth}</p>
                                    <p className="text-xs text-muted-foreground">{stats.mostCommonMonthCount} orang</p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <Users className="w-8 h-8 text-green-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Rata-rata Umur</p>
                                    <p className="text-lg font-bold">{stats.averageAge} tahun</p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <Cake className="w-8 h-8 text-orange-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Birthday Twins</p>
                                    <p className="text-lg font-bold">{birthdayTwins.length} pasang</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
