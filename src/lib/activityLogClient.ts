export function parseActivityMeta(log: any) {
  try {
    const defaultMeta = { ip: "127.0.0.1", browser: "Chrome", role: "Staff", raw: null as string | null };
    let parsedOld: any = {};
    let parsedNew: any = {};

    try {
      parsedOld = JSON.parse(log.oldValue || "{}");
    } catch {
      parsedOld = { raw: log.oldValue };
    }

    try {
      parsedNew = JSON.parse(log.newValue || "{}");
    } catch {
      parsedNew = { raw: log.newValue };
    }

    const ip = parsedOld.ip || parsedNew.ip || defaultMeta.ip;
    const browser = parsedOld.browser || parsedNew.browser || defaultMeta.browser;
    const role = parsedOld.role || parsedNew.role || defaultMeta.role;

    const oldRaw = parsedOld.raw !== undefined ? parsedOld.raw : log.oldValue;
    const newRaw = parsedNew.raw !== undefined ? parsedNew.raw : log.newValue;

    return { ip, browser, role, oldValue: oldRaw, newValue: newRaw };
  } catch (e) {
    return {
      ip: "127.0.0.1",
      browser: "Chrome",
      role: "Staff",
      oldValue: log.oldValue,
      newValue: log.newValue
    };
  }
}
