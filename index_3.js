// Парсер отрабатывает  120 элементов в среднем за 6 -7 минут.
// Принцип данного парсера отличается от того, что в index тем, что скроллит и сразу кликает по подгруженным элементам
// Элементы в google maps добавляются(при подгрузке) при скролле по порядку и в дом дереве также сохраняется порядок, что и так очевидно
// Поэтому извлечение идет по индексу (то есть зависит от количества всех эл. - прокликанные эл.)
// Извлечение по индексу - не лучший ВАРИАНТ!!!!
// Данный принцип создан просто как один из вариантов, не очень надежных на практике, 
// т.к. порой бывает вклинивается рекламные элементы в список и могут записаться не все данные в файл!

import puppeteer from "puppeteer";
import * as fs from "fs";

const mapsParser = async (req) => {
  const browser = await puppeteer.launch({ headless: true });
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
                // page.$eval('.Nv2PK', (el) => el !== null)
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

      let startIndex = 0;

      while (true) {
        const findList = await page.$$(".Nv2PK");
        const filteredArr = Array.from(findList).slice(startIndex);
        startIndex += filteredArr.length;

        // Порой в список попадают рекламные элементы (ЧУДЕСА и ТОЛЬКО!!!!) - для отслеживания всех элементов
        // const arr = await page.$$eval('.Nv2PK', (elements) => {
        //   return elements.map((element) => {
        //     const id = element.querySelector('.hfpxzc').getAttribute('aria-label').split('·')[0];
        //     return { id };
        //   });
        // });

        const elementExists = await page.$(".HlvSq");
        if (elementExists && !filteredArr.length) {
          break;
        }

        for (let i = 0; i < filteredArr.length; i++) {
          const li = filteredArr[i];
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

// const observer = new IntersectionObserver(
//   (entries) => {
//     entries.forEach((entry) => {
//       if (entry.isIntersecting) {
//         // Элемент виден, пытаемся кликнуть на него
//         li.click();
//         clickSuccess = true;
//         observer.disconnect(); // Прекращаем наблюдение за элементом
//       }
//     });
//   },
//   { threshold: 0.5 } // Вызывать callback, когда хотя бы 50% элемента видно
// );

// // Начинаем наблюдать за элементом
// observer.observe(li);

// // Ждем, пока клик будет успешным или наблюдатель отключится
// await new Promise((resolve) => {
//   const timeout = setTimeout(() => {
//     if (!clickSuccess) {
//       console.warn("Element is not visible, skipping it.");
//       observer.disconnect();
//     }
//     resolve();
//   }, 5000); // Таймаут через 5 секунд

//   observer.onDisconnect = () => {
//     clearTimeout(timeout);
//     resolve();
//   };
// });

// const isElementVisible = async (element) => {
//   const boundingBox = await element.boundingBox();
//   const viewportHeight = await page.viewport().height;
//   const viewportWidth = await page.viewport().width;

//   return (
//     boundingBox.y >= 0 &&
//     boundingBox.y <= viewportHeight &&
//     boundingBox.x >= 0 &&
//     boundingBox.x <= viewportWidth
//   );
// };

// await page.waitUntil(
//   async () => {
//     const isVisible = await isElementVisible(li);
//     if (isVisible) {
//       await li.click();
//       clickSuccess = true;
//       return true;
//     }
//     return false;
//   },
//   { timeout: 2000 }
// );
