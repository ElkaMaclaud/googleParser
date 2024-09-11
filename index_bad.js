// Работоспособный код, но с багами и совершает много лишней работы!!!!!!!!!!!!!!!!!

import puppeteer from "puppeteer";
import * as fs from "fs";

const mapsParser = async (req) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://www.google.ru/maps", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await page.setViewport({ width: 1480, height: 1000 });

  await page.waitForSelector("input");
  await page.click("input");
  await page.type("input", req, { delay: 100 });
  await page.keyboard.press("Enter");

  await page.waitForSelector(".L1xEbb", { visible: true, timeout: 4000 });
  await page.click(".L1xEbb");

  const allData = { data: [] };
  const clickedElements = new Set();
  const uniqueData = new Set();
  let clickCount = 0;

  while (true) {
    const findList = await page.$$(".Nv2PK");
    if (findList.length === 0) {
      console.log("Все элементы были кликнуты или не найдены.");
      break;
    }
    // const scrollableElement = await page.waitForSelector("#QA0Szd .QjC7t", {
    //   visible: true,
    //   timeout: 4000,
    // });
    const clickPromises = findList.map(async (li) => {
      const elementId = await page.evaluate((el) => el.outerHTML, li);

      if (!clickedElements.has(elementId)) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        try {
          await li.click();
          clickedElements.add(elementId);
          clickCount++;
        } catch (error) {
          console.error("Ошибка при клике на элемент:", error);
          return;
        }

        console.log(
          "Кликнули на элемент:",
          await page.evaluate((el) => el.innerText, li),
          clickedElements.size
        );

        const elementCard = await page.waitForSelector(
          "#QA0Szd div.w6VYqd > div.Hu9e2e.tTVLSc > div > div.e07Vkf.kA9KIf > div > div > div.XiKgde",
          { visible: true, timeout: 2000 }
        );
        if (elementCard) {
          try {
            const result = await page.evaluate((element) => {
              const name = element.querySelector("h1");
              const address = element.querySelector("[data-item-id='address']");
              const website = element.querySelector(
                "[data-item-id='authority']"
              );
              const phone = element.querySelector(
                "[data-item-id^='phone:tel:']"
              );
              return {
                name: name ? name.innerText : "",
                address: address ? address.innerText : "",
                website: website ? website.href : "",
                phone: phone
                  ? phone.getAttribute("data-item-id").replace("phone:tel:", "")
                  : "",
              };
            }, elementCard);

            const uniqueKey =
              result.name + result.address + result.website + result.phone;
            if (!uniqueData.has(uniqueKey)) {
              uniqueData.add(uniqueKey);
              allData.data.push(result);
            }
          } catch (error) {
            console.error("Ошибка при получении данных:", error);
          }
        } else {
          console.error("Элемент карточки не найден или не видим.");
        }

        if (clickCount % 5 === 0) {
          await page.evaluate((elScr) => {
            const scrollableElement = document.querySelector("#QA0Szd .QjC7t");
            if (scrollableElement) {
              // scrollableElement.scrollTop += 1500;
              scrollableElement.scrollBy(0, 1500);
            } else {
              console.log("Элемент прокрутки не найден");
            }
          });
          // await page.waitForTimeout(2000);
        }
      }
    });

    await Promise.all(clickPromises);
  }

  console.log("allData.data.length: ", allData.data.length);
  fs.writeFile(
    `${request.split(" ").join("_")}.db.json`,
    JSON.stringify(allData, null, 2),
    (err) => {
      if (err) throw err;
    }
  );

  await browser.close(); // Закрываем браузер после завершения
};

const request = process.argv.slice(2).join(" ") || "Рестораны Казани";
mapsParser(request);
