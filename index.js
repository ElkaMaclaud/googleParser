// Парсер медленный по скорости, но вполне надежный: со 120 элементами работает примерно 9 - 10 минут
// Данный парсер изначально проскроливает все элементы (чтобы разом получить их) и только потом прокликивает по ним!

import puppeteer from "puppeteer";
import * as fs from "fs";

const mapsParser = async (req) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const MAX_RETRIES = 3;
  const TIMEOUT = 10000;
  let attempt = 0;

  const startParsing = async () => {
    try {
      await page.goto("https://www.google.ru/maps", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.setViewport({ width: 1480, height: 1000 });

      await page.waitForSelector("input", {
        waitUntil: "visible",
        timeout: 3000,
      });

      await page.click("input");
      await page.type("input", req, { delay: 200 });
      await page.keyboard.press("Enter");

      await page.waitForSelector(".L1xEbb", { visible: true, timeout: 2000 });
      await page.click(".L1xEbb");

      await page.mouse.wheel({ deltaY: 1500 });

      await page.waitForSelector(".Nv2PK", { visible: true, timeout: 2000 });

      while (true) {
        const startTime = Date.now();
    
        await page.evaluate(() => {
            const scrollableElement = document.querySelector("#QA0Szd .QjC7t");
            if (scrollableElement) {
                scrollableElement.scrollBy(0, 1500);
            } 
        });
    
    
        if (Date.now() - startTime > TIMEOUT) {
            console.log("Перезагрузка страницы из-за подвисания");
            await page.reload();
            continue; 
        }
        
        await new Promise((resolve) => setTimeout(resolve, 500));
    
        const elementExists = await page.$(".HlvSq");
        if (elementExists) {
            break;
        }
    }
    

      const findList = await page.$$(".Nv2PK");
      console.log(`Получено: ${findList.length} организаций`);

      const uniqueData = new Set();
      const allData = { data: [] };
      async function processElements(li, count = 1) {
        if (count > 6) {
          // Да, такое кол-во по одному элементу вполне возможно при долгом ответе или "подсании" (в редких случаях)
          return;
        } else if (!(count % 2)) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        async function clickAndGetElementData(li) {
          let clickSuccess = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              if (await page.evaluate((element) => element.isConnected, li)) {
                // page.$eval('.Nv2PK', (el) => el !== null)
                await li.click();
                clickSuccess = true;
                break;
              } else {
                const id = await page.evaluate((element) => {
                  const el = element.querySelector(".hfpxzc");
                  const value = el.getAttribute("aria-label")
                    ? el.getAttribute("aria-label").split("·")[0]
                    : "";
                  return value;
                }, li);
                console.log("Элемент больше не находится в DOM-дереве", id);
              }
            } catch (error) {
              console.error("Ошибка при КЛИКЕ на элемент:", error);
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          }
          if (clickSuccess) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const element = await page.waitForSelector(
              "#QA0Szd div.w6VYqd > div.Hu9e2e.tTVLSc > div > div.e07Vkf.kA9KIf > div > div > div.XiKgde",
              { visible: true, timeout: 2000 }
            );

            if (element) {
              const result = await page.evaluate((el) => {
                const name = el.querySelector("h1");
                const adress = el.querySelector("[data-item-id='address']");
                const website = el.querySelector("[data-item-id='authority']");
                const phone = el.querySelector("[data-item-id^='phone:tel:']");
                return {
                  name: name ? name.innerText.trim() : "",
                  adress: adress
                    ? adress.innerText
                        .trim()
                        .replace(/^[^a-zA-Zа-яА-Я0-9]+/, "")
                    : "",
                  website: website ? website.href.trim() : "",
                  phone: phone
                    ? phone
                        .getAttribute("data-item-id")
                        .replace("phone:tel:", "")
                        .trim()
                    : "",
                };
              }, element);

              const uniqueKey =
                result.name + result.adress + result.website + result.phone;
              if (!uniqueData.has(uniqueKey)) {
                uniqueData.add(uniqueKey);
                allData.data.push(result);
              } else {
                await processElements(li, count + 1);
              }
            }
          } else {
            const id = await page.evaluate((element) => {
              const el = element.querySelector(".hfpxzc");
              const value = el.getAttribute("aria-label")
                ? el.getAttribute("aria-label").split("·")[0]
                : "";
              return value;
            }, li);
            console.log("НЕТ ЭЛЕМЕНТА", id, li);
          }
        }
        await clickAndGetElementData(li);
      }

      for (let li of findList) {
        await processElements(li);
      }

      console.log(`Записано и сохранено: ${allData.data.length} организаций`);
      fs.writeFile(
        `${req.split(" ").join("_")}_scrollStart.db.json`,
        JSON.stringify(allData, null, 2),
        (err) => {
          if (err) throw err;
        }
      );
    } catch (error) {
      console.error("Ошибка:", error);
      if (attempt < MAX_RETRIES) {
        attempt++;
        console.log(`Попытка перезапуска парсера: ${attempt}`);
        await page.reload();
        await startParsing();
      } else {
        console.error(
          "Максимальное количество попыток исчерпано. Завершение работы."
        );
      }
    }
  };

  await startParsing();
  await browser.close();
};

const request = process.argv.slice(2).join(" ") || "Рестораны Казани";
mapsParser(request);