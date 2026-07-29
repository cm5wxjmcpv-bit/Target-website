export const APP_CONFIG = {
  appName: "TargetSolutions Dashboard",
  departmentName: "Martinsville Fire & EMS",
  apiUrl: "https://script.google.com/macros/s/AKfycbz6DjEd3WdowFVDk1fs8YZhHD-f1eR043QRlkkHNHbfHyPDEBFU3AIscICJdBI-YQ6C/exec",
  legacyApiUrls: [
    "https://script.google.com/macros/s/AKfycbytTrK4cqkFuU30-ZK5lqAWpVyjw0cln_1JyQDTnmE55GBt35_thViWr97oSX8Fn51G/exec",
    "https://script.google.com/macros/s/AKfycbwqAP0qVUUElDZydwU8SnOpI0lCX-4qbZjiHSHIfJz5KRm3HvymVfeK435ukF9HgTMD/exec",
    "https://script.google.com/macros/s/AKfycbyqtrFHrVhbwuQ9RSQ5cMSnPRbdygxLX15cSOlFWDJsmpB5ec-_WM1nSe6awCUVHr5M/exec",
  ],
  sessionStorageKey: "target-dashboard-session",
  apiStorageKey: "target-dashboard-api-url",
} as const;
