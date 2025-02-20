// Парсер медленный по скорости, но вполне надежный: со 120 элементами работает примерно 9 - 10 минут
// Данный парсер изначально проскроливает все элементы (чтобы разом получить их) и только потом прокликивает по ним!

import puppeteer from "puppeteer";
import * as fs from "fs";

const mapsParser = async (req) => {
  const browser = await puppeteer.launch({
    headless: true, args: [
      '--disable-notifications',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-extensions',
      '--disable-popup-blocking'
    ]
  });

  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().includes('push')) {
      request.abort(); // Отменить запросы на пуш-уведомления
    } else {
      request.continue();
    }
  });

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

      await page.waitForSelector(".L1xEbb", { visible: true });

      await page.click(".L1xEbb");

      await page.mouse.wheel({ deltaY: 1500 });

      await page.waitForSelector(".Nv2PK", { visible: true });

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

      async function hideDialogIfExists() {
        await page.evaluate(() => {
          const dialog = document.querySelector('div#ucc-0'); 
          if (dialog) {
            dialog.style.display = 'none';
            console.log("Элемент скрыт.");
          } else {
            console.log("Элемент не найден.");
          }
        });
      }

      const findList = await page.$$(".Nv2PK");
      console.log(`Получено: ${findList.length} организаций`);

      const uniqueData = new Set();
      const allData = { data: [] };
      async function processElements(li, count = 1) {
        if (count > 3) {
          return;
        } 
        await new Promise((resolve) => setTimeout(resolve, 1000));

        async function clickAndGetElementData(li) {
          let clickSuccess = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              if (await page.evaluate((element) => element.isConnected, li)) {
                const linkElementHandle = await page.evaluateHandle((element) => {
                  return element.querySelector('a');
                }, li);
                
                const id = await linkElementHandle.evaluate((el) => {
                  return el.getAttribute("aria-label") || "";
                });
                
                // Проверяем, содержит ли aria-label символ "·Посещенная ссылка"
                if (id.match(/·/)) {
                  console.log("Элемент уже посещен, пропускаем клик:", id);
                  clickSuccess = true;
                  break;
                } else {
                  await hideDialogIfExists();
                  await linkElementHandle.click();
                  clickSuccess = true;
                  break;
                }
              } else {
                const id = await page.evaluate((element) => {
                  const el = element.querySelector(".hfpxzc");
                  const value = el.getAttribute("aria-label")
                    ? el.getAttribute("aria-label").split("·")[0]
                    : "";
                  return value;
                }, li);
                console.log("Элемент больше не находится в DOM-дереве", id);
                attempt = 3;
              }
            } catch (error) {
              console.error("Ошибка при КЛИКЕ на элемент:", error);
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          }
          if (clickSuccess) {
              await new Promise((resolve) => setTimeout(resolve, 4000));
              const element = await page.waitForSelector(
                "#QA0Szd div.w6VYqd > div.Hu9e2e.tTVLSc > div > div.e07Vkf.kA9KIf > div > div > div.XiKgde",
                { visible: true }
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
                  console.log("На данный элемент уже кликали", uniqueKey)
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