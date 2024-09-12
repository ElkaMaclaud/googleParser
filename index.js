// Парсер медленный (со 120 элементами работает более 12 минут)
// Так как пришлось поставить задержки при клике на элементы  в полученном списке
// Данный парсер изначально проскроливает все элементы (чтобы разом получить их) и только потом прокликивает по ним!

import puppeteer from "puppeteer";
import * as fs from "fs";

const mapsParser = async (req) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const MAX_RETRIES = 3; // Максимальное количество попыток
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
        await page.evaluate(() => {
          const scrollableElement = document.querySelector("#QA0Szd .QjC7t");
          if (scrollableElement) {
            scrollableElement.scrollBy(0, 1500);
          } else {
            console.log("Элемент прокрутки не найден");
          }
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const elementExists = await page.$(".HlvSq");
        if (elementExists) {
          console.log("Элемент .HlvSq найден, прекращаем прокрутку.");
          break;
        }
      }

      const findList = await page.$$(".Nv2PK");
      console.log("findList.length: ", findList.length);

      const uniqueData = new Set();
      const allData = { data: [] };
      
      async function clickAndGetElementData(li) {
        // const elementHandle = await li.evaluateHandle((el) => el);
        // const elementId = await page.evaluate((el) => el.outerHTML, elementHandle);
        for (let i = 0; i < 3; i++) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await li.click();
            break;
          } catch(error) {
            console.error("Ошибка при КЛИКЕ на элемент:", error);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
          } else {
            console.log(
              "/////////////////////////////////////////////////////////",
              uniqueKey
            );
            await clickAndGetElementData(li);
            // fs.appendFileSync("data.json", JSON.stringify(data) + "\n", (err) => {if(err) throw err})
          }
        }
      }

      for (let li of findList) {
        await clickAndGetElementData(li);
      }

      console.log("allData.data.length:  ", allData.data.length);
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
