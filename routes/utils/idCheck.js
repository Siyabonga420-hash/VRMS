// utils/idCheck.js
// Checks that an ID / passport number is plausible and, for South African
// ID numbers, that it matches the date of birth.
//
// A South African ID is 13 digits: YYMMDD SSSS C A Z
//   YYMMDD = date of birth, C = citizen (0) or resident (1), Z = Luhn check digit.

function luhnValid(digits) {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        let n = Number(digits[digits.length - 1 - i]);
        if (i % 2 === 1) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
    }
    return sum % 10 === 0;
}

const pad = (n) => String(n).padStart(2, '0');

// Returns an error message (string) if something is wrong, or null if OK.
// dobStr is 'YYYY-MM-DD'.
function validateIdentity(idNumberRaw, dobStr) {
    const id = String(idNumberRaw || '').replace(/\s+/g, '').toUpperCase();

    // Digits only -> must be a proper 13-digit South African ID
    if (/^\d+$/.test(id)) {
        if (id.length !== 13) {
            return 'A South African ID number must be exactly 13 digits. (If you are using a passport, enter the passport number including its letters.)';
        }
        const yy = Number(id.slice(0, 2));
        const mm = Number(id.slice(2, 4));
        const dd = Number(id.slice(4, 6));

        // pick the century that gives a birth date in the past
        let year = 2000 + yy;
        if (Date.UTC(year, mm - 1, dd) > Date.now()) year -= 100;

        const d = new Date(Date.UTC(year, mm - 1, dd));
        if (d.getUTCFullYear() !== year || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) {
            return 'That ID number contains an invalid birth date.';
        }
        if (id[10] !== '0' && id[10] !== '1') {
            return 'That ID number is not valid. Please check it and try again.';
        }
        if (!luhnValid(id)) {
            return 'That ID number is not valid (the check digit is wrong). Please check it and try again.';
        }
        if (dobStr !== `${year}-${pad(mm)}-${pad(dd)}`) {
            return 'Your date of birth does not match your ID number.';
        }
        return null;
    }

    // Contains letters -> treat as a passport number (cannot be checked against the DOB)
    if (!/^[A-Z0-9]{6,20}$/.test(id)) {
        return 'Enter a valid 13-digit ID number or a passport number (6 to 20 letters/numbers).';
    }
    return null;
}

module.exports = { validateIdentity };