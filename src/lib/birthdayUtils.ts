import type { Person } from '@/types';

export interface UpcomingBirthday {
    person: Person;
    daysUntil: number;
    nextBirthday: Date;
    ageOnNextBirthday: number;
    isToday: boolean;
    isTomorrow: boolean;
}

// Get days until next birthday
export function getDaysUntilBirthday(birthDate: Date): number {
    const today = new Date();
    const currentYear = today.getFullYear();

    // Create birthday this year
    let nextBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());

    // If birthday already passed this year, use next year
    if (nextBirthday < today) {
        nextBirthday = new Date(currentYear + 1, birthDate.getMonth(), birthDate.getDate());
    }

    // Calculate difference in days
    const diffTime = nextBirthday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
}

// Calculate age on next birthday
export function getAgeOnNextBirthday(birthDate: Date): number {
    const today = new Date();
    const currentYear = today.getFullYear();
    const birthYear = birthDate.getFullYear();

    let age = currentYear - birthYear;

    // Check if birthday hasn't occurred yet this year
    const todayMonthDay = today.getMonth() * 100 + today.getDate();
    const birthMonthDay = birthDate.getMonth() * 100 + birthDate.getDate();

    if (todayMonthDay < birthMonthDay) {
        // Birthday this year
        age = age;
    } else {
        // Birthday next year
        age = age + 1;
    }

    return age;
}

// Get upcoming birthdays sorted by date
export function getUpcomingBirthdays(persons: Person[], limit: number = 10): UpcomingBirthday[] {
    const birthdays: UpcomingBirthday[] = [];

    for (const person of persons) {
        if (!person.birthDate) continue;

        try {
            const birthDate = new Date(person.birthDate);
            if (isNaN(birthDate.getTime())) continue; // Invalid date
            const daysUntil = getDaysUntilBirthday(birthDate);
            const today = new Date();
            const nextYear = today.getFullYear() + (daysUntil > 365 ? 0 : (birthDate.getMonth() < today.getMonth() ||
                (birthDate.getMonth() === today.getMonth() && birthDate.getDate() < today.getDate()) ? 1 : 0));

            const nextBirthday = new Date(nextYear, birthDate.getMonth(), birthDate.getDate());
            const ageOnNextBirthday = getAgeOnNextBirthday(birthDate);

            birthdays.push({
                person,
                daysUntil,
                nextBirthday,
                ageOnNextBirthday,
                isToday: daysUntil === 0,
                isTomorrow: daysUntil === 1,
            });
        } catch (error) {
            // Skip invalid dates
            continue;
        }
    }

    // Sort by days until birthday
    birthdays.sort((a, b) => a.daysUntil - b.daysUntil);

    return birthdays.slice(0, limit);
}

// Get all birthdays in a specific month
export function getBirthdaysByMonth(persons: Person[], month: number, year: number): { day: number; persons: Person[] }[] {
    const birthdaysByDay: Record<number, Person[]> = {};

    for (const person of persons) {
        if (!person.birthDate) continue;

        try {
            const birthDate = new Date(person.birthDate);
            if (isNaN(birthDate.getTime())) continue;
            if (birthDate.getMonth() === month) {
                const day = birthDate.getDate();
                if (!birthdaysByDay[day]) {
                    birthdaysByDay[day] = [];
                }
                birthdaysByDay[day].push(person);
            }
        } catch (error) {
            continue;
        }
    }

    // Convert to array format
    return Object.entries(birthdaysByDay).map(([day, persons]) => ({
        day: parseInt(day),
        persons,
    }));
}

// Find birthday twins (people with same birthday)
export function getBirthdayTwins(persons: Person[]): { date: string; persons: Person[] }[] {
    const birthdayGroups: Record<string, Person[]> = {};

    for (const person of persons) {
        if (!person.birthDate) continue;

        const birthDate = new Date(person.birthDate);
        const key = `${birthDate.getMonth()}-${birthDate.getDate()}`;

        if (!birthdayGroups[key]) {
            birthdayGroups[key] = [];
        }
        birthdayGroups[key].push(person);
    }

    // Filter only groups with 2+ people
    const twins = Object.entries(birthdayGroups)
        .filter(([_, persons]) => persons.length >= 2)
        .map(([date, persons]) => ({ date, persons }));

    return twins;
}

// Get birthday statistics
export function getBirthdayStats(persons: Person[]) {
    const monthCounts: Record<number, number> = {};
    let totalAge = 0;
    let count = 0;

    for (const person of persons) {
        if (!person.birthDate) continue;

        const birthDate = new Date(person.birthDate);
        const month = birthDate.getMonth();

        monthCounts[month] = (monthCounts[month] || 0) + 1;

        // Calculate current age (account for whether birthday has occurred this year)
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const hasHadBirthdayThisYear =
            today.getMonth() > birthDate.getMonth() ||
            (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

        if (!hasHadBirthdayThisYear) {
            age--;
        }

        totalAge += age;
        count++;
    }

    // Find most common month
    let mostCommonMonth = 0;
    let maxCount = 0;
    for (const [month, count] of Object.entries(monthCounts)) {
        if (count > maxCount) {
            maxCount = count;
            mostCommonMonth = parseInt(month);
        }
    }

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    return {
        mostCommonMonth: monthNames[mostCommonMonth],
        mostCommonMonthCount: maxCount,
        averageAge: count > 0 ? Math.round(totalAge / count) : 0,
        totalWithBirthdays: count,
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
