const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

async function register(page, email, password, displayName) {
  await page.goto('/register');
  await page.fill('#displayName', displayName);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/boards');
}

async function login(page, email, password) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/boards');
}

// dnd-kit uses PointerSensor with activationConstraint: { distance: 8 }
// page.dragTo() skips pointer events so it doesn't trigger activation — use this instead
async function pointerDrag(page, source, target, steps = 20) {
  const sb = await source.boundingBox();
  const tb = await target.boundingBox();
  const sx = sb.x + sb.width / 2;
  const sy = sb.y + sb.height / 2;
  const tx = tb.x + tb.width / 2;
  const ty = tb.y + tb.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx, sy + 10, { steps: 3 }); // cross activation threshold (distance: 8)
  await page.mouse.move(tx, ty, { steps });
  await page.mouse.up();
}

module.exports = { uid, register, login, pointerDrag };
