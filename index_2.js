// Парсер отрабатывает  120 элементов в среднем за за 6 -7 минут.
// Принцип данного парсера отличается от того, что в index тем, что скроллит и сразу кликает по подгруженным элементам
// Данный парсер предполагает, что элементы, прогружаясь при скроллинге идут не по порядку
// И в связи с этим, после каждого скролла, получаем все элементы и ФИЛЬТРУЕМ их, отсекая уже прокликанные
// Хотя в данном случае, элементы в google maps и добавляются (при подгрузке) при скролле по порядку и в дом дереве также сохраняется порядок,
// но все же мы их каждый раз фильтруем для надежности, а не по индексу отсекаем как в парсере, представленном в index_3!

import puppeteer from "puppeteer";
import * as fs from "fs";

const mapsParser = async (req) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const MAX_RETRIES = 3;
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

      await page.waitForSelector(".Nv2PK", { visible: true, timeout: 6000 });

      const allData = { data: [] };
      const uniqueData = new Set();
      const clickedElements = new Set();

      async function processElements(li, count = 1) {
        if (count > 6) {
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
                return
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
            console.log("НЕТ ЭЛЕМЕНТА", id);
          }
        }
        await clickAndGetElementData(li);
      }

      let filteredArr = [];

      while (true) {
        const findList = await page.$$(".Nv2PK");
        filteredArr = [];

        for (let li of findList) {
          // const elementHandle = await li.evaluateHandle((el) => el);
          // const elementId = await page.evaluate((el) => el.outerHTML, elementHandle);
          const elementId = await page.evaluate((element) => {
            const name = element
              .querySelector(".hfpxzc")
              .getAttribute("aria-label")
              .split("·")[0];
            const href = element.querySelector(".hfpxzc").href;
            return name + href;
          }, li);

          if (!clickedElements.has(elementId)) {
            filteredArr.push(li);
          }
        }

        const elementExists = await page.$(".HlvSq");
        if (elementExists && !filteredArr.length) {
          break;
        }

        for (let i = 0; i < filteredArr.length; i++) {
          const li = filteredArr[i];
          // const elementHandle = await li.evaluateHandle((el) => el);
          // const elementId = await page.evaluate((el) => el.outerHTML, elementHandle);
          const elementId = await page.evaluate((element) => {
            const name = element
              .querySelector(".hfpxzc")
              .getAttribute("aria-label")
              .split("·")[0];
            const href = element.querySelector(".hfpxzc").href;
            return name + href;
          }, li);
          clickedElements.add(elementId);
          await processElements(li);
        }

        await page.evaluate(() => {
          const elScr = document.querySelector("#QA0Szd .QjC7t");
          if (elScr) {
            elScr.scrollBy(0, 1500);
          }
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(`Записано и сохранено: ${allData.data.length} организаций`);
      fs.writeFile(
        `${req.split(" ").join("_")}_3.db.json`,
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
