import * as cheerio from "cheerio";

/**
 * @argument {string} relativePath
 */
function getSuisURL(relativePath) {
    return new URL(relativePath, "https://suis.sabanciuniv.edu").toString();
}

/**
 * @argument {cheerio.CheerioAPI} $
 * @argument {Element} headerElement
 */
function parseCourseHeader($, headerElement) {
    const text = $(headerElement).text().trim();
    const a = $(headerElement).find('a')[0];
    const detailURL = getSuisURL($(a).attr('href'));
    const match = text.match(/^(.+?) \- ([0-9]*) \- ([A-Z]*) ([0-9]*)([A-Z]*) \- ([A-Z0-9]*)(?:(?:  \[ Syllabus \])?|$)/);
    const obj = {
        name: match[1],
        crn: +match[2],
        subject: match[3],
        code: +match[4],
        type: match[5] || null,
        section: match[6],
        detailURL: detailURL
    };
    return obj;
}

/**
 * @argument {cheerio.CheerioAPI} $
 * @argument {Element} tableElement
 * @returns {string[][]}
 */
function parseTable($, tableElement) {
    const rowElems = $(tableElement).find("tbody > tr");
    const rows = [];
    for (const rowElem of rowElems) {
        const colElems = $(rowElem).children('td, th');
        const cols = [];
        for (const colElem of colElems) {
            cols.push($(colElem).text().trim());
        }
        rows.push(cols);
    }
    return rows;
}

/**
 * @argument {string[][]} table
 * @returns {Record<string, string>[]}
 */
function groupTable(table) {
    const data = [];
    for (let i=1; i<table.length; ++i) {
        const obj = {};
        for (let j=0; j<table[i].length; ++j) {
            const key = table[0][j];
            obj[key] = table[i][j];
        }
        data.push(obj);
    }
    return data;
}

/**
 * @argument {string} text
 */
function shortenFacultyName(text) {
    const replacements = [
        [ "Fac.of Arts and Social Sci.", "FASS" ],
        [ "Sabancı Business School", "FMAN" ],
        [ "Fac. of Engin. and Nat. Sci.", "FENS" ],
        [ "School of Languages Building", "SL" ],
        [ "University Center", "UC" ]
    ]
    for (const replacement of replacements) {
        text = text.replace(new RegExp(replacement[0], "g"), replacement[1]);
    }
    return text;
}

/**
 * @argument {string} text 
 */
function parseRange(text) {
    const split = text.split(" - ");
    return {
        from: split[0],
        to: split[1]
    };
}

/**
 * @argument {cheerio.CheerioAPI} $
 * @argument {Element} tableElement
 */
function parseScheduleTable($, tableElement) {
    const table = groupTable(parseTable($, tableElement));
    return table.map((entry) => {
        return {
            type: entry["Type"] || null,
            time: entry["Time"] ? parseRange(entry["Time"]) : null,
            days: entry["Days"] || null,
            where: entry["Where"] ? shortenFacultyName(entry["Where"]) : null,
            dateRange: entry["Date Range"] ? parseRange(entry["Date Range"]) : null,
            scheduleType: entry["Shedule Type"] ?? null,
            instructors: entry["Instructors"] ?
                entry["Instructors"].replace(/ +/g, " ").replace(/ \(P\)/g, "")
                .split(", ").map((a) => a.trim()) : null,
        };
    });
}

/**
 * @argument {cheerio.CheerioAPI} $
 * @argument {Element} tableElement
 */
function parseAvailabilityTable($, tableElement) {
    const table = groupTable(parseTable($, tableElement));
    return table.map((entry) => {
        return {
            title: entry[""] || null,
            capacity: isNaN(entry["Capacity"]) ? null : +entry["Capacity"],
            actual: isNaN(entry["Actual"]) ? null : +entry["Actual"],
            remaining: isNaN(entry["Remaining"]) ? null : +entry["Remaining"]
        };
    });
}

/**
 * @argument {string} str
 * @argument {string} prefix
 */
function trimPrefix(str, prefix) {
    if (str.startsWith(prefix)) {
        str = str.slice(prefix.length);
    }
    return str;
}

/**
 * @argument {string} str
 * @argument {string} suffix
 */
function trimSuffix(str, suffix) {
    if (str.endsWith(suffix)) {
        str = str.slice(0, str.length - suffix.length);
    }
    return str;
}

/**
 * @argument {cheerio.CheerioAPI} $
 * @argument {Element} detailsElement
 */
function parseCourseDetails($, detailsElement) {
    const children = $(detailsElement).contents();
    const obj = {};
    for (let i=0; i<children.length; ++i) {
        const child = children[i];
        const text = $(child).text().trim();
        if (child.type === 'tag' && child.tagName === 'span') {
            const detailChild = children[i+1];
            const brChild = children[i+2];
            i += 2;
            if (detailChild?.type !== 'text') {
                continue;
            }
            if (brChild?.type !== 'tag' || brChild.tagName !== 'br') {
                continue;
            }
            const detail = $(detailChild).text().trim();
            switch (text) {
                case "Associated Term:":
                    obj.term = detail;
                    break;
                case "Registration Dates:":
                    obj.registrationDates = detail;
                    break;
                case "Levels:":
                    obj.levels = detail.split(", ");
                    break;
                case "Faculty:":
                    obj.faculty = trimPrefix(detail, "Course Offered by ");
                    break;
                case "Attributes:":
                default: {
                    let match = detail.match(/([0-9]+) ECTS/);
                    if (match != null) {
                        obj.ects = +match[1];
                    }
                    match = detail.match(/Lang\. of Instruction: ([a-zA-Z]+)/);
                    if (match != null) {
                        obj.language = match[1];
                    }
                    match = detail.match(/Course Offered by ([A-Za-z]+)/);
                    if (match != null) {
                        obj.faculty = match[1];
                    }
                    break;
                }
            }
        }
        else if (child.type === 'tag' && child.tagName === 'a') {
            switch (text) {
                case "View Catalog Entry":
                    obj.catalogEntryURL = getSuisURL($(child).attr('href'));
                    break;
            }
        }
        else if (child.type === 'tag' && child.tagName === 'table') {
            const caption = $($(child).find('caption')[0]).text().trim();
            switch (caption) {
                case "Scheduled Meeting Times": {
                    const table = parseScheduleTable($, child);
                    obj.schedule = table;
                    break;
                }
                case "Registration Availability": {
                    const table = parseAvailabilityTable($, child);
                    obj.availability = table;
                    break;
                }
            }
        }
        else if (child.type === 'text') {
            if (text.endsWith(" Credits")) {
                obj.credits = +trimSuffix(text, " Credits");
            }
            else if (text.endsWith(" Schedule Type")) {
                obj.scheduleType = trimSuffix(text, " Schedule Type");
            }
            else if (text.endsWith(" Campus")) {
                obj.campus = trimSuffix(text, " Campus");
            }
            else if (text.endsWith(" Instructional Method")) {
                obj.method = trimSuffix(text, " Instructional Method");
            }
        }
    }
    return obj;
}

/**
 * @argument {cheerio.CheerioAPI} $
 * @argument {Element} headerElement
 * @argument {Element} detailsElement
 */
function parseCourse($, headerElement, detailsElement) {
    const headerData = parseCourseHeader($, headerElement);
    const details = parseCourseDetails($, detailsElement);
    return { ...headerData, ...details };
}

/**
 * @param {string} html
 */
export function parseCourses(html) {
    const $ = cheerio.load(html);
    const entries = $('body > div.pagebodydiv > table.datadisplaytable > tbody > tr').children()
        .filter(function(){ return $(this.parent.parent.parent).attr("width") === "100%"; })
    const courses = [];
    for (let i=0; i<entries.length; i+=2) {
        const headerElement = entries[i];
        const detailsElement = entries[i+1];
        
        const course = parseCourse($, headerElement, detailsElement);
        courses.push(course);
    }
    return courses;
}

/**
 * @param {string} html
 */
export function parseCourseDetailsPage(html) {
    const $ = cheerio.load(html);
    const dataElem = $('body > div.pagebodydiv > table.datadisplaytable > tbody > tr > td.dddefault');
    const detail = parseCourseDetails($, dataElem);
    return detail;
}

/**
 * @param {string} html
 */
export function extractSubjects(html) {
    const $ = cheerio.load(html);
    const list = $('#subj_id');
    const subjects = [];
    for (const optionElem of list.children('option')) {
        const option = $(optionElem);
        subjects.push({
            name: option.attr('value'),
            description: option.text()
        });
    }
    return subjects;
}