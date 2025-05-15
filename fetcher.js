import { extractSubjects, extractTerms, parseCourseDetailsPage, parseCourses } from "./parser.js";
import crypto from "crypto";
import { existsSync, mkdirSync } from "fs";
import { writeFile, readFile, rename, mkdir } from "fs/promises";
import path from "path";
import async from 'async';

/**
 * @param {string} text
 */
function sha1(text) {
    return crypto.createHash('sha1').update(Buffer.from(text, 'utf-8'))
        .digest().toString('hex');
}

/**
 * @param {string} cacheKey
 */
function pathsForCacheKey(cacheKey) {
    const hash = sha1(cacheKey);
    const container = path.join("fetch-cache", hash.substring(0, 2),
        hash.substring(2, 4));
    const data = path.join(container, hash);
    const metadata = data + ".txt";
    return { container, data, metadata };
}

/**
 * @param {string} cacheKey
 */
async function loadCache(cacheKey) {
    const paths = pathsForCacheKey(cacheKey);
    let data = null;
    if (existsSync(paths.data)) {
        data = await readFile(paths.data, 'utf-8');
    }
    return data;
}

/**
 * @param {string} path
 * @param {string} text
 */
async function writeFileAtomic(path, text) {
    await writeFile(path + "~", text);
    await rename(path + "~", path);
}

/**
 * @param {string} cacheKey
 * @param {string} text
 */
async function saveCache(cacheKey, text) {
    const paths = pathsForCacheKey(cacheKey);
    if (!existsSync(paths.container)) {
        await mkdir(paths.container, { recursive: true });
    }
    await writeFileAtomic(paths.metadata, cacheKey);
    await writeFileAtomic(paths.data, text);
}

/**
 * @argument {string | URL} url
 * @argument {RequestInit?} opts
 */
async function fetchText(url, opts) {
    if (!existsSync("fetch-cache")) {
        await mkdir("fetch-cache");
    }
    const cacheKey = (opts?.method ?? "GET") + " " + url.toString() + " "
        + ((opts?.headers != null) ? JSON.stringify(opts.headers) : "") + " "
        + ((opts?.body != null) ? Buffer.from(opts.body, 'utf-8').toString('utf-8') : "");
    let data = await loadCache(cacheKey);
    if (data != null) {
        return data;
    }
    console.log(opts?.method ?? "GET", url.toString());
    const res = await fetch(url, opts);
    if (!res.ok) {
        throw new Error("Non-OK status code: " + res.status);
    }
    const text = await res.text();
    await saveCache(cacheKey, text);
    return text;
}

/**
 * @argument {string} term
 */
async function fetchSubjectsForTerm(term) {
    const req = `p_calling_proc=bwckschd.p_disp_dyn_sched&p_term=${term}`;
    const html = await fetchText("https://suis.sabanciuniv.edu/prod/bwckgens.p_proc_term_date", {
        body: Buffer.from(req, 'utf-8'),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST" });
    const subjects = extractSubjects(html);
    return subjects;
}

/**
 * @param {any[]} courses 
 */
function *detailFetchersForCourses(courses) {
    let i=0;
    for (const course of courses) {
        yield async() => {
            console.log(`[${++i} / ${courses.length}]`);
            console.log(`${course.subject}${course.code}${course.type || ""}-${course.section || "0"} "${course.name}"`)
            const detailHtml = await fetchText(course.detailURL);
            const detail = parseCourseDetailsPage(detailHtml);
            Object.assign(course, detail);
        };
    }
}

/**
 * @argument {string} term
 */
async function fetchCoursesForTerm(term) {
    let req = "sel_subj=dummy&sel_day=dummy" +
        "&sel_schd=dummy&sel_insm=dummy&sel_camp=dummy&sel_levl=dummy" +
        "&sel_sess=dummy&sel_instr=dummy&sel_ptrm=dummy&sel_attr=dummy" +
        "&sel_crse=&sel_title=&sel_from_cred=&sel_to_cred=&begin_hh=0" +
        "&begin_mi=0&begin_ap=a&end_hh=0&end_mi=0&end_ap=a";
    const subjects = await fetchSubjectsForTerm(term);
    for (const subject of subjects) {
        req += "&sel_subj=" + subject.name;
    }
    req += "&term_in=" + term;
    const html = await fetchText("https://suis.sabanciuniv.edu/prod/bwckschd.p_get_crse_unsec", {
        body: Buffer.from(req, 'utf-8'),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST" });
    const courses = parseCourses(html);
    await async.parallelLimit(detailFetchersForCourses(courses), 8)
    return courses;
}

/**
 * @param {string} termCode
 */
async function fetchTerm(termCode) {
    const term = await fetchCoursesForTerm(termCode);
    mkdirSync("out", { recursive: true });
    await writeFileAtomic(`out/${termCode}.json`, JSON.stringify(term));
    await writeFileAtomic(`out/${termCode}-pretty.json`, JSON.stringify(term, null, 2));
}

async function fetchTermList() {
    const termsHTML = await fetchText("https://suis.sabanciuniv.edu/prod/bwckschd.p_disp_dyn_sched");
    return extractTerms(termsHTML);
}

async function main() {
    const cmd = process.argv[2];
    const arg1 = process.argv[3];
    if (cmd === "fetch" && arg1 != null) {
        await fetchTerm(arg1);
    }
    else if (cmd === "list-terms") {
        for (const term of await fetchTermList()) {
            console.log(`[${term.term}] ${term.name}`);
        }
    }
    else if (cmd === "fetch-last" && arg1 != null) {
        const terms = (await fetchTermList())
            .reverse().slice(0, +arg1);
        let i = 0, count = +arg1;
        if (count > terms.length) {
            count = terms.length;
        }
        for (const term of terms) {
            console.log(`... Fetching term ${++i} of ${count}: ${term.name} (${term.term})`);
            await fetchTerm(term.term);
        }
    }
    else {
        console.error(
            "Usage:\n" +
            "  fetcher.js fetch <term>\n" +
            "  fetcher.js fetch-last <n-terms>\n" +
            "  fetcher.js list-terms\n");
        process.exit(1);
    }
}

main();
