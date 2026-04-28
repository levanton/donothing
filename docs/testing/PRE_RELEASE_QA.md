# Pre-release QA checklist

Працюй цим списком перед кожним TestFlight build'ом. Скрізь де "✅" — те, що має бути true. Якщо щось не сходиться — це баг для розслідування, не "пройти і йти далі".

> Останнє оновлення: одразу після нещодавніх правок (sand-grain progress, pause icon overlay, SessionCompleteScreen flat bg, AppState bg/fg = pause, scheduled-block conflict resolution).

---

## ⚡ Мінімальний smoke — 5 хв

Базовий "чи запускається взагалі":

1. **Cold install** (видалити app → `npm run ios`)
   - ✅ Onboarding проходить без помилок
   - ✅ Daily goal зберігається після cold-restart
2. **Запусти 1-хв сесію → дочекайся 00:00**
   - ✅ Cross-fade у SessionCompleteScreen (без disc circle reveal)
   - ✅ "1" centered, "min" справа, "with yourself" italic під ними
3. **Натисни interrupt під час сесії**
   - ✅ Pause sheet піднімається + pause icon plавно fade-in'ить (360ms)
   - ✅ Sand-grain прогрес видно
4. **Force-quit під час сесії → знов відкрити**
   - ✅ Home екран чистий
   - ✅ В History сесія за цей час збережена
5. **Створи Scheduled Block → запусти timer → блок firing під час сесії**
   - ✅ Жодного UI-вторгнення (BlockSheet НЕ перекриває timer)
   - ✅ Після session end → BlockSheet з'являється

Якщо щось з #1–5 не працює — стоп, фікси перш ніж ризикувати на TestFlight.

---

## 🔴 Data safety (Phase 1 review fixes)

### Cold-start partial save
- [ ] Запусти 5-хв сесію → 2 хв тиші
- [ ] **Force-quit** через swipe-up (не background!)
- [ ] Знов відкрий → ✅ нема recovery sheet
- [ ] Activity Calendar за сьогодні → ✅ є ~2-хв сесія

### editScheduledBlock з revoked permission
- [ ] Створи block у Settings
- [ ] iOS Settings → Screen Time → відключи дозвіл для donothing
- [ ] Повернись → Settings → tap block → save
- [ ] ✅ Alert "Could not update block — Check Screen Time permissions"
- [ ] ✅ Block у списку лишається на старому часі (DB rolled back)

### Onboarding fail (важко відтворити, опційно)
- [ ] Якщо disk full / DB locked — Alert + не позначає complete

### Mood записується і **читається**
- [ ] Заверши сесію → постав mood → `next`
- [ ] Закрий екран
- [ ] Відкрий ту ж сесію в History → ✅ mood відображається

---

## 🟡 Lifecycle / Scheduled blocks (recent fixes)

### AppState pause
- [ ] Timer → swipe-up в App Switcher → return → ✅ pause sheet
- [ ] Timer → pull-down Notification Center → close → ✅ pause sheet
- [ ] Timer → Home button → return → ✅ pause sheet

### Bg/fg швидкий toggle
- [ ] Timer → background → forerocks 2-3 рази швидко
- [ ] ✅ Сесія коректно паузується (одна, не дубль)
- [ ] ✅ Block-sheet не з'являється помилково

### Focus timer після background
- [ ] Створи 5-хв focus lock → дочекайся 1 хв
- [ ] Background на 2-3 хв → foreground
- [ ] ✅ remaining ~2 хв (не 4 хв)

### Scheduled block during session — NEW
- [ ] Створи block з firing у +2 хв, unlockGoal=2 хв
- [ ] Запусти 5-хв сесію (звичайну, не block)
- [ ] Дочекайся firing блока:
  - ✅ Notif banner НЕ з'являється у foreground
  - ✅ BlockSheet НЕ перекриває timer
- [ ] Дочекайся завершення сесії → completeSession
  - ✅ SessionCompleteScreen → close → BlockSheet з'являється
  - ⚠️ Юзер мусить ще раз робити unlockGoal (поки що — це accepted behavior, є TODO про credit-логіку)

### Block during pause
- [ ] Запусти сесію → interrupt → pause sheet відкритий
- [ ] Дочекайся firing блока
  - ✅ Pause sheet залишається, BlockSheet НЕ виходить
- [ ] Tap `back home` → stopSession
  - ✅ BlockSheet з'являється після close pause sheet

---

## 🟢 SessionCompleteScreen (recent reshape)

### Layout / typography
- [ ] Запусти 1-хв сесію → дочекайся 00:00
- [ ] ✅ Cross-fade в терракотовий екран (немає splash disc circle reveal)
- [ ] ✅ Цифра ("1") точно по центру екрана
- [ ] ✅ "min" справа поза цим центром, baseline-aligned
- [ ] ✅ Цифра `fontWeight: 600` (середньо-жирна)
- [ ] ✅ "with yourself" italic, окремий рядок
- [ ] ✅ НЕМАЄ "today, that's X min"
- [ ] ✅ Sun-grass illustration над цифрою

### Перевір на різних довжинах
- [ ] Сесія 5 хв → "5 min" (одна цифра, центрована)
- [ ] Сесія 50 хв → "50 min" (дві цифри, центровано)
- [ ] Сесія 120+ хв → "120 min" (три цифри, центровано)
- [ ] У всіх випадках "min" висить ОДНАКОВО справа від цифри

### Mood phase
- [ ] Tap `next` після benefits
- [ ] ✅ Sun і disc виростають
- [ ] ✅ "drag" hint з'являється на ~600ms (не чекає 1.5s)
- [ ] ✅ Drag по кільцях → mood label оновлюється (still/lighter/refreshed/full)
- [ ] ✅ Hint зникає одразу після першого drag

### Farewell phase
- [ ] Після mood tap `next` → farewell
- [ ] ✅ Sun ковзає вниз, "see you tomorrow" + "well done" + duration chip
- [ ] ✅ Дві кнопки: pill `unlock your apps` + текст `just done` зверху
- [ ] Tap `just done` → ✅ close (apps НЕ unblock'аються — навіть якщо вони не були locked, це ок)
- [ ] Tap `unlock your apps` → ✅ close + forceUnblockAll

### Close-анімація
- [ ] Будь-яка кнопка → ✅ просто content fade-out (360ms), без disc-shrinking назад на yes-button

---

## 🔵 Pause sheet (interrupt)

### Pause icon overlay
- [ ] Timer → interrupt
- [ ] ✅ Pause icon (sand mask) плавно fade-in 360ms одночасно з підняттям sheet'а
- [ ] ✅ Icon centered на 25% від верху екрана
- [ ] ✅ Розмір ~60% ширини екрана (≤280px)
- [ ] Tap continue / start over / back home
- [ ] ✅ Icon fade-out **на місці** (не їде вниз з sheet'ом)

### Sand-grain progress bar
- [ ] Pause при elapsed=2 хв з goal=10 хв
- [ ] ✅ ~30 точок по горизонталі
- [ ] ✅ Майбутні — темні (як body text), 2.5px
- [ ] ✅ Минулі — терракотові, 4px
- [ ] ✅ Lead grain (остання заповнена) — 9px з halo (м'який shadow)
- [ ] Цифри `00:01` / `10:00` під barом
  - ✅ `fontWeight: 500` (трохи жирніше)
  - ✅ Tabular-nums (моноширинні)

### Pause sheet button row
- [ ] ✅ Primary: terracotta pill `continue`
- [ ] ✅ Secondary row: `start over` (іконка rotate-ccw) + `back home` / `unlock now`
- [ ] Block session → `back home` має бути `unlock now`
- [ ] Continue → resume звідки залишилося, а не з нуля

### Free-mode (no goal)
- [ ] Запусти session з goalSeconds=0 (вільний режим, якщо доступно)
- [ ] Pause → ✅ heroLabel = `so far` (не `left to do nothing`)
- [ ] ✅ Progress bar прихований

---

## 🟣 BlockSheet

### Visual
- [ ] Прийми block firing → BlockSheet з'являється
- [ ] ✅ Mountain illustration на терракотовому backdrop'і (поза sheet'ом)
- [ ] ✅ "your apps are locked" eyebrow chip
- [ ] ✅ Big number `1 min` (cifra `fontWeight: 300`, легка, без heavy serif features)
- [ ] ✅ "of doing nothing" subtitle
- [ ] ✅ Mood pills: rest / calm / focus
- [ ] ✅ Primary `do nothing` pill
- [ ] ✅ Secondary outline `hold to unlock now` (lock icon)

### Hold-to-unlock
- [ ] Tap and hold `hold to unlock now` 1.5s
- [ ] ✅ Progress fill ростe всередині pill'а
- [ ] ✅ На 100% — haptics.success + apps unblocked + sheet close
- [ ] Release before 100% → ✅ progress сходить назад (200ms)

### Start a session
- [ ] Tap `do nothing`
- [ ] ✅ Session starts с `sessionOrigin: 'block'`, `goalSeconds = unlockMin*60`
- [ ] ✅ Pause sheet потім матиме `unlock now` замість `back home`

---

## 🔵 Schema migrations

### Clean install
- [ ] Видалити app з девайса повністю
- [ ] `npm run ios`
- [ ] ✅ Onboarding працює
- [ ] ✅ Daily goal зберігається

### SQLite перевірка через Xcode → Devices → app container → download → відкрити .db
```sql
SELECT * FROM _migrations;
-- має містити версії 1, 2, 3, 4, 5, 6, 7, 8

SELECT name FROM sqlite_master WHERE type='table';
-- має містити: sessions, scheduled_blocks, milestones, weekly_checkins,
--              settings, device_state, _migrations
-- НЕ має містити: reminders (drop'нута)

PRAGMA table_info(sessions);
-- має містити: deleted_at, version, та user_id NOT NULL з default 'local'

-- CHECK constraints:
INSERT INTO scheduled_blocks (id, hour, minute, duration_minutes) VALUES ('bad', 99, 0, 60);
-- має fail: CHECK constraint failed: hour >= 0 AND hour < 24
```

### Upgrade-path (через `git stash`)
```bash
git stash
npm run ios     # стара версія, наповнити дані
git stash pop
npm run ios     # нова версія — міграції 7/8 mають відпрацювати
```
- [ ] ✅ Існуючі сесії та scheduled blocks переживають оновлення
- [ ] ✅ Жодних втрат рядків

---

## 🟤 Settings

### Notification banner
- [ ] Settings open
- [ ] iOS Settings → відключи notif для donothing
- [ ] Повернись → ✅ notif banner з'являється з fade-in
- [ ] Tap banner → ✅ відкривається iOS Settings

### Screen Time banner
- [ ] iOS Settings → відключи Screen Time для donothing
- [ ] Settings open у app → ✅ Screen Time banner з'являється
- [ ] Tap → ✅ requestAuth (якщо undetermined) або openSettings (якщо denied)

### Scheduled blocks
- [ ] Tap "Add screen block"
- [ ] BlockPicker — час, тривалість, weekdays, unlockGoal
- [ ] Save → ✅ блок з'являється у списку
- [ ] Toggle on/off → ✅ native register/unregister
- [ ] Edit existing block → ✅ зберігає або rollback з alert
- [ ] Delete (swipe / tap delete) → ✅ видаляється

---

## 🟥 History / Activity Calendar

- [ ] Open History
- [ ] ✅ Stats blocks (today / total / streak / longest)
- [ ] ✅ Activity Calendar — поточний місяць, інтенсивність bubbles
- [ ] Tap день → ✅ список сесій за цей день з mood
- [ ] Swipe сесію → delete → ✅ видаляється
- [ ] Delete весь день (icon) → ✅ всі сесії за день зникають

---

## ⚪ Console — на що дивитися

```
[store.x] *** failed                         ← реальна помилка, треба розслідування
[store.completeSession] dbAddSession failed  ← data-loss issue
[store.editScheduledBlock] rollback failed   ← native стан розсинхронізовано з DB
[lifecycle] notif sub1 remove failed         ← cleanup leak
[lifecycle] AppState sub remove failed       ← те ж саме
[migration002] *** seed failed               ← AsyncStorage corruption
```

---

## 🔘 Незавершене (не блокує TestFlight, але треба знати)

Документую для повноти — це не баги, це фічі що очікують RevenueCat або окремих PR'ів:

- **Delete account** — стаб у `app/index.tsx:118-121`, треба wipe DB + RevenueCat detach
- **Restore Purchases** у paywall'ах — `<Pressable>` без onPress (AccountSheet ця кнопка робоча)
- **AccountSheet URLs** — `donothing.app/terms`, `/privacy`, `support@donothing.app` placeholder'и; App Store ID `0000000000`
- **RevenueCat** не встановлений — `isSubscribed: true` за замовчуванням; всі paywall handlers викликають onFinish напряму
- **Daily reminder** — `scheduleDailyNotification` готова, але ніде не викликана
- **Weekly check-ins** — таблиця + helper'и є, UI відсутній (можна drop'нути або реалізувати)
- **Edit сесії в History** — тільки delete, не edit (для виправлення mood після факту)

---

## ⛔ Known issue не блокує

- **Block fires during session → BlockSheet still asks for full unlockGoal after session ends.** Користувач щойно зробив тишу 10 хв, але block з 5-хв unlockGoal все одно з'являється. Поки не credit'ується — є TODO в плані. Юзер може просто скасувати через `hold to unlock now`.

---

## 📦 Якщо щось зламалося — швидкий rollback

```bash
git revert <commit-sha>   # окремий коміт
git push
```

Або точково з конкретного файлу:
```bash
git checkout <commit-sha> -- path/to/file.ts
```

---

*Цей документ — living checklist. Додавай / прибирай тести коли змінюється функціонал. Тримай у `docs/testing/` поряд з іншими.*
