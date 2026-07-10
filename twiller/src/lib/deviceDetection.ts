// Helper: Get the current time in IST
export const getISTDate = (): Date => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5)); // IST is UTC+5.5
};

export const getISTTimeDetails = () => {
  const istDate = getISTDate();
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  return { hours, minutes, formattedTime };
};

// Check if payment window is open (10:00 AM - 11:00 AM IST)
export const isPaymentWindowOpen = (): boolean => {
  const { hours } = getISTTimeDetails();
  return hours === 10;
};

// Check if mobile login window is open (10:00 AM - 1:00 PM IST)
export const isMobileLoginAllowed = (): boolean => {
  const { hours } = getISTTimeDetails();
  return hours >= 10 && hours < 13;
};

// Interface for device and browser information
export interface DeviceDetails {
  browser: string;
  os: string;
  deviceCategory: "desktop" | "laptop" | "mobile";
  userAgent: string;
}

// Parse user agent string
export const getDeviceDetails = (): DeviceDetails => {
  if (typeof window === "undefined") {
    return {
      browser: "Unknown",
      os: "Unknown",
      deviceCategory: "desktop",
      userAgent: "",
    };
  }

  const userAgent = navigator.userAgent || "";
  let browser = "Other";
  let os = "Other";
  let deviceCategory: "desktop" | "laptop" | "mobile" = "desktop";

  // OS Detection
  if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os x/i.test(userAgent)) os = "macOS";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/linux/i.test(userAgent)) os = "Linux";

  // Browser Detection
  const isMicrosoft = /edg|edge|trident|msie/i.test(userAgent);
  const isChrome = /chrome|crios/i.test(userAgent) && !isMicrosoft;
  const isSafari = /safari/i.test(userAgent) && !isChrome && !isMicrosoft;
  const isFirefox = /firefox|fxios/i.test(userAgent);

  if (isMicrosoft) browser = "Microsoft Browser";
  else if (isChrome) browser = "Google Chrome";
  else if (isSafari) browser = "Safari";
  else if (isFirefox) browser = "Firefox";

  // Device Category Detection
  const isMobile = /mobile|android|iphone|ipod/i.test(userAgent) || (os === "iOS" && window.innerHeight < 1024);
  if (isMobile) {
    deviceCategory = "mobile";
  } else {
    // Distinguish laptop vs desktop using screen width heuristic
    const width = window.innerWidth;
    if (width <= 1600) {
      deviceCategory = "laptop";
    } else {
      deviceCategory = "desktop";
    }
  }

  return { browser, os, deviceCategory, userAgent };
};
