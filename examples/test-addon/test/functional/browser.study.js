/* eslint-env node, mocha */
/* global browser */

const assert = require("assert");
const utils = require("./utils");
const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

// TODO create new profile per test?
// then we can test with a clean profile every time

describe("Shield Study Add-on Utils Functional Tests", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;

  before(async() => {
    driver = await utils.setup.promiseSetupDriver(utils.FIREFOX_PREFERENCES);
    await utils.setup.installAddon(driver);
    await utils.ui.openBrowserConsole(driver);
  });

  // hint: skipping driver.quit() may be useful when debugging failed tests,
  // leaving the browser open allowing inspection of the ui and browser logs
  after(() => driver.quit());

  it("should be able to access window.browser from the extension page for tests", async() => {
    const hasAccessToWebExtensionApi = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        callback(typeof browser === "object");
      },
    );
    assert(hasAccessToWebExtensionApi);
  });

  it("should be able to access study WebExtensions API from the extension page for tests", async() => {
    const hasAccessToShieldUtilsWebExtensionApi = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        callback(browser && typeof browser.study === "object");
      },
    );
    assert(hasAccessToShieldUtilsWebExtensionApi);
  });

  it("should return the correct variation based on specific weightedVariations", async() => {
    const chosenVariation = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        const weightedVariations = [
          {
            name: "control",
            weight: 1,
          },
          {
            name: "kittens",
            weight: 1.5,
          },
          {
            name: "puppers",
            weight: 2,
          },
        ];

        const fraction = 0.3;
        const variation = await browser.study.deterministicVariation(
          weightedVariations,
          fraction,
        );

        callback(variation);
      },
    );
    assert(chosenVariation.name === "kittens");
  });

  /*
  it("telemetry should be working", async() => {
    const shieldTelemetryPing = await driver.executeAsyncScript(
      async callback => {
        const { fakeSetup, getMostRecentPingsByType } = Components.utils.import(
          "resource://test-addon/utils.jsm",
          {},
        );
        const { studyUtils } = Components.utils.import(
          "resource://test-addon/StudyUtils.jsm",
          {},
        );
        Components.utils.import("resource://gre/modules/TelemetryArchive.jsm");

        fakeSetup();

        await studyUtils.telemetry({ foo: "bar" });

        // TODO Fix this hackiness; caused by addClientId option in submitExternalPing
        // The ping seems to be sending (appears in about:telemetry) but does not appear
        // in the pings array
        await new Promise(resolve => setTimeout(resolve, 1000));

        const shieldPings = await getMostRecentPingsByType(
          "shield-study-addon",
        );
        callback(shieldPings[0]);
      },
    );
    assert(shieldTelemetryPing.payload.data.attributes.foo === "bar");
  });

  describe('test the library\'s "startup" process', function() {
    it("should send the correct ping on first seen", async() => {
      const firstSeenPing = await driver.executeAsyncScript(async callback => {
        const { fakeSetup, getMostRecentPingsByType } = Components.utils.import(
          "resource://test-addon/utils.jsm",
          {},
        );
        const { studyUtils } = Components.utils.import(
          "resource://test-addon/StudyUtils.jsm",
          {},
        );
        Components.utils.import("resource://gre/modules/TelemetryArchive.jsm");

        fakeSetup();

        studyUtils.firstSeen();

        const studyPings = await getMostRecentPingsByType("shield-study");
        callback(studyPings[0]);
      });
      assert(firstSeenPing.payload.data.study_state === "enter");
    });

    it("should set the experiment to active in Telemetry", async() => {
      const activeExperiments = await driver.executeAsyncScript(
        async callback => {
          const { fakeSetup } = Components.utils.import(
            "resource://test-addon/utils.jsm",
            {},
          );
          const { studyUtils } = Components.utils.import(
            "resource://test-addon/StudyUtils.jsm",
            {},
          );
          Components.utils.import(
            "resource://gre/modules/TelemetryEnvironment.jsm",
          );

          fakeSetup();

          studyUtils.setActive();

          callback(TelemetryEnvironment.getActiveExperiments());
        },
      );
      assert(activeExperiments.hasOwnProperty("shield-utils-test"));
    });

    it("should send the correct telemetry ping on first install", async() => {
      const installedPing = await driver.executeAsyncScript(async callback => {
        const { fakeSetup, getMostRecentPingsByType } = Components.utils.import(
          "resource://test-addon/utils.jsm",
          {},
        );
        const { studyUtils } = Components.utils.import(
          "resource://test-addon/StudyUtils.jsm",
          {},
        );
        Components.utils.import("resource://gre/modules/TelemetryArchive.jsm");

        fakeSetup();

        await studyUtils.startup({ reason: 5 }); // ADDON_INSTALL = 5

        const studyPings = await getMostRecentPingsByType("shield-study");
        callback(studyPings[0]);
      });
      assert(installedPing.payload.data.study_state === "installed");
    });
  });

  describe("test the library's endStudy() function", function() {
    before(async() => {
      await driver.executeAsyncScript(async callback => {
        const { fakeSetup } = Components.utils.import(
          "resource://test-addon/utils.jsm",
          {},
        );
        const { studyUtils } = Components.utils.import(
          "resource://test-addon/StudyUtils.jsm",
          {},
        );

        fakeSetup();

        // TODO add tests for other reasons (?)
        await studyUtils.endStudy({
          reason: "expired",
          fullname: "TEST_FULLNAME",
        });
        callback();
      });
    });

    it("should set the experiment as inactive", async() => {
      const activeExperiments = await driver.executeAsyncScript(
        async callback => {
          Components.utils.import(
            "resource://gre/modules/TelemetryEnvironment.jsm",
          );
          callback(TelemetryEnvironment.getActiveExperiments());
        },
      );
      assert(!activeExperiments.hasOwnProperty("shield-utils-test"));
    });

    describe("test the opening of an URL at the end of the study", function() {
      it("should open a new tab", async() => {
        const newTabOpened = await driver.wait(async() => {
          const handles = await driver.getAllWindowHandles();
          return handles.length === 2; // opened a new tab
        }, 3000);
        assert(newTabOpened);
      });

      it("should open a new tab to the correct URL", async() => {
        const currentHandle = await driver.getWindowHandle();
        driver.setContext(Context.CONTENT);
        // Find the new window handle.
        let newWindowHandle = null;
        const handles = await driver.getAllWindowHandles();
        for (const handle of handles) {
          if (handle !== currentHandle) {
            newWindowHandle = handle;
          }
        }
        const correctURLOpened = await driver.wait(async() => {
          await driver.switchTo().window(newWindowHandle);
          const currentURL = await driver.getCurrentUrl();
          return currentURL.startsWith(
            "http://www.example.com/?reason=expired",
          );
        });
        assert(correctURLOpened);
      });
    });

    it("should send the correct reason telemetry", async() => {
      const pings = await driver.executeAsyncScript(async callback => {
        const { getMostRecentPingsByType } = Components.utils.import(
          "resource://test-addon/utils.jsm",
          {},
        );
        const studyPings = await getMostRecentPingsByType("shield-study");
        callback(studyPings[1]); // ping before the most recent ping
      });
      assert(pings.payload.data.study_state === "expired");
    });

    it("should send the uninstall telemetry", async() => {
      const pings = await driver.executeAsyncScript(async callback => {
        const { getMostRecentPingsByType } = Components.utils.import(
          "resource://test-addon/utils.jsm",
          {},
        );
        const studyPings = await getMostRecentPingsByType("shield-study");
        callback(studyPings[0]);
      });
      assert(pings.payload.data.study_state === "exit");
    });
  });
  */
});