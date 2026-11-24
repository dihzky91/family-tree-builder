import type { Person } from '@/types';
import {
    parseFlexibleDate,
    calculateFlexibleAge,
    INDONESIAN_MONTHS,
} from '@/lib/flexibleDateUtils';

export interface UpcomingBirthday {
    person: Person;
    daysUntil: number;
    nextBirthday: Date;
    ageOnNextBirthday: number | null;
    isApproximateAge: boolean;
    isToday: boolean;
    isTomorrow: boolean;
}

// Get days until next birthday given 0-indexed month and 1-indexed day
export function getDaysUntilMonthDay(monthIndex: number, day: number): number {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const currentYear = todayStart.getFullYear();

    let nextBirthday = new Date(currentYear, monthIndex, day);

    if (nextBirthday < todayStart) {
        nextBirthday = new Date(currentYear + 1, monthIndex, day);
    }

    const diffTime = nextBirthday.getTime() - todayStart.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
}

// Backwards-compatible helper
export function getDaysUntilBirthday(birthDate: Date): number {
    return getDaysUntilMonthDay(birthDate.getMonth(), birthDate.getDate());
}

// Calculate age on next birthday
export function getAgeOnNextBirthday(birthDate: Date): number {
    const today = new Date();
    const currentYear = today.getFullYear();
    const birthYear = birthDate.getFullYear();

    let age = currentYear - birthYear;

    const todayMonthDay = today.getMonth() * 100 + today.getDate();
    const birthMonthDay = birthDate.getMonth() * 100 + birthDate.getDate();

    if (todayMonthDay > birthMonthDay) {
        age = age + 1;
    }

    return age;
}

// Get upcoming birthdays sorted by date (only includes persons with known month & day)
export function getUpcomingBirthdays(persons: Person[], limit: number = 10): UpcomingBirthday[] {
    const birthdays: UpcomingBirthday[] = [];
    const today = new Date();

    for (const person of persons) {
        if (!person.birthDate) continue;

        const parsed = parseFlexibleDate(person.birthDate);
        // Only include in daily birthday countdown if both month and day are specifically known
        if (!parsed || !parsed.hasSpecificMonthDay || !parsed.date1.month || !parsed.date1.day) {
            continue;
        }

        const monthIndex = parsed.date1.month - 1;
        const day = parsed.date1.day;
        const daysUntil = getDaysUntilMonthDay(monthIndex, day);

        const hasPassedThisYear =
            monthIndex < today.getMonth() ||
            (monthIndex === today.getMonth() && day < today.getDate());
        const nextYear = today.getFullYear() + (hasPassedThisYear ? 1 : 0);
        const nextBirthday = new Date(nextYear, monthIndex, day);

        let ageOnNextBirthday: number | null = null;
        if (parsed.estimatedYear !== null) {
            ageOnNextBirthday = nextYear - parsed.estimatedYear;
        }

        birthdays.push({
            person,
            daysUntil,
            nextBirthday,
            ageOnNextBirthday,
            isApproximateAge: parsed.isApproximate,
            isToday: daysUntil === 0,
            isTomorrow: daysUntil === 1,
        });
    }

    birthdays.sort((a, b) => a.daysUntil - b.daysUntil);

    return birthdays.slice(0, limit);
}

// Get all birthdays in a specific month with exact day known
export function getBirthdaysByMonth(
    persons: Person[],
    month: number,
    _year?: number
): { day: number; persons: Person[] }[] {
    const birthdaysByDay: Record<number, Person[]> = {};

    for (const person of persons) {
        if (!person.birthDate) continue;

        const parsed = parseFlexibleDate(person.birthDate);
        if (!parsed || !parsed.hasSpecificMonthDay || !parsed.date1.month || !parsed.date1.day) {
            continue;
        }

        if (parsed.date1.month - 1 === month) {
            const day = parsed.date1.day;
            if (!birthdaysByDay[day]) {
                birthdaysByDay[day] = [];
            }
            birthdaysByDay[day].push(person);
        }
    }

    return Object.entries(birthdaysByDay).map(([day, list]) => ({
        day: parseInt(day, 10),
        persons: list,
    }));
}

// Get persons born in a specific month whose exact day of the month is unknown (e.g. "Mei 1950" or "Sekitar Mei 1950")
export function getMonthOnlyBirthdays(persons: Person[], month: number): Person[] {
    return persons.filter((person) => {
        if (!person.birthDate) return false;
        const parsed = parseFlexibleDate(person.birthDate);
        if (!parsed) return false;
        return (
            parsed.hasSpecificMonth &&
            !parsed.hasSpecificMonthDay &&
            parsed.date1.month === month + 1
        );
    });
}

// Find birthday twins (people with same known month & day)
export function getBirthdayTwins(persons: Person[]): { date: string; persons: Person[] }[] {
    const birthdayGroups: Record<string, Person[]> = {};

    for (const person of persons) {
        if (!person.birthDate) continue;

        const parsed = parseFlexibleDate(person.birthDate);
        if (!parsed || !parsed.hasSpecificMonthDay || !parsed.date1.month || !parsed.date1.day) {
            continue;
        }

        const key = `${parsed.date1.month - 1}-${parsed.date1.day}`;

        if (!birthdayGroups[key]) {
            birthdayGroups[key] = [];
        }
        birthdayGroups[key].push(person);
    }

    return Object.entries(birthdayGroups)
        .filter(([_, list]) => list.length >= 2)
        .map(([date, list]) => ({ date, persons: list }));
}

// Get birthday & age statistics
export function getBirthdayStats(persons: Person[]) {
    const monthCounts: Record<number, number> = {};
    let totalAge = 0;
    let ageCount = 0;
    let calendarEligibleCount = 0;
    let approximateNoDayCount = 0;

    for (const person of persons) {
        if (!person.birthDate) continue;

        const parsed = parseFlexibleDate(person.birthDate);
        if (!parsed) continue;

        if (parsed.hasSpecificMonthDay) {
            calendarEligibleCount++;
        } else {
            approximateNoDayCount++;
        }

        // Count birth month if month is known (even if day is unknown)
        if (parsed.hasSpecificMonth && parsed.date1.month) {
            const monthIdx = parsed.date1.month - 1;
            monthCounts[monthIdx] = (monthCounts[monthIdx] || 0) + 1;
        }

        // Calculate age if year (or estimated year) is known
        const ageInfo = calculateFlexibleAge(person.birthDate, person.deathDate);
        if (ageInfo !== null) {
            totalAge += ageInfo.age;
            ageCount++;
        }
    }

    let mostCommonMonth = -1;
    let maxCount = 0;
    for (const [month, c] of Object.entries(monthCounts)) {
        if (c > maxCount) {
            maxCount = c;
            mostCommonMonth = parseInt(month, 10);
        }
    }

    return {
        mostCommonMonth: mostCommonMonth >= 0 ? INDONESIAN_MONTHS[mostCommonMonth] : '—',
        mostCommonMonthCount: maxCount,
        averageAge: ageCount > 0 ? Math.round(totalAge / ageCount) : 0,
        totalWithBirthdays: calendarEligibleCount,
        totalWithEstimatedAge: ageCount,
        approximateNoDayCount,
    };
}

// Format countdown text
export function formatCountdown(daysUntil: number): string {
    if (daysUntil === 0) return 'Hari ini!';
    if (daysUntil === 1) return 'Besok';
    if (daysUntil <= 7) return `Dalam ${daysUntil} hari`;
    if (daysUntil <= 30) return `Dalam ${Math.floor(daysUntil / 7)} minggu`;
    return `Dalam ${Math.floor(daysUntil / 30)} bulan`;
}
