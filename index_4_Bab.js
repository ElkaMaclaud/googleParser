import puppeteer from "puppeteer";
import * as fs from "fs";

const mapsParser = async (req) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  // await page.setUserAgent(
  //     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  //   );

  await page.goto("https://www.google.ru/maps", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await page.setViewport({ width: 1480, height: 1000 });

  await page.waitForSelector("input", { waitUntil: 3000 });

  await page.click("input");
  await page.type("input", req, { delay: 200 });
  await page.keyboard.press("Enter");

  await page.waitForSelector(".L1xEbb", { visible: true, timeout: 4000 });
  await page.click(".L1xEbb");

  await page.mouse.wheel({ deltaY: 1500 });

  await page.waitForSelector(".Nv2PK", { visible: true, timeout: 4000 });

  const allData = { data: [] };

  const clickedElements = new Set();
  const uniqueData = new Set();
  
  while (true) {
    const findList = await page.$$(".Nv2PK");
    const scrollableElement = await page.waitForSelector("#QA0Szd .QjC7t", {
      visible: true,
      timeout: 4000,
    });

    let newElementFound = false;
    let clickCount = 0;

    for (let li of findList) {
      const elementHandle = await li.evaluateHandle((el) => el);
      const elementId = await page.evaluate(
        (el) => el.outerHTML,
        elementHandle
      );

      if (!clickedElements.has(elementId)) {
        await li.click();
        clickedElements.add(elementId);
        newElementFound = true;
        clickCount++;

        const element = await page.waitForSelector(
          "#QA0Szd div.w6VYqd > div.Hu9e2e.tTVLSc > div > div.e07Vkf.kA9KIf > div > div > div.XiKgde",
          { visible: true, timeout: 2000 }
        );

        const result = await page.evaluate((el) => {
          const name = el.querySelector("h1");
          const adress = el.querySelector("[data-item-id='address']");
          const website = el.querySelector("[data-item-id='authority']");
          const phone = el.querySelector("[data-item-id^='phone:tel:']");
          return {
            name: name ? name.innerText : "",
            adress: adress ? adress.innerText : "",
            website: website ? website.href : "",
            phone: phone
              ? phone.getAttribute("data-item-id").replace("phone:tel:", "")
              : "",
          };
        }, element);

        const uniqueKey =
          result.name + result.adress + result.website + result.phone;
        if (!uniqueData.has(uniqueKey)) {
          uniqueData.add(uniqueKey);
          allData.data.push(result);
        }
        // Прокручиваем страницу после каждых 5 кликов
        if (clickCount % 5 === 0) {
          await page.evaluate((elScr) => {
            elScr.scrollBy(0, 1500);
          }, scrollableElement);
          await new Promise((resolve) => setTimeout(resolve, 4000));
          break;
        }
      }
    }

    if (!newElementFound) {
      console.log("Все элементы были кликнуты.");
      break;
    }
  }

  console.log("allData.data.length:  ", allData.data.length);
  fs.writeFile(`${request.split(" ").join("_")}.db.json`, JSON.stringify(allData, null, 2), (err) => {
    if (err) throw err;
  });
};

const request = process.argv.slice(2).join(" ") || "Рестораны Казани";
mapsParser(request);
