# GraphEdit — Backend

Серверна частина **GraphEdit**: REST API для карт знань, користувачів, прогресу та статистики.

> Актуальна назва папки — **`graphedit-server`**.  
> Стара **`knowledgemap-server`** не підтримується — не запускайте її.

## Технології

- NestJS 11, TypeScript
- TypeORM, MySQL (Aiven або локально)
- Firebase Admin — перевірка JWT
- Swagger — документація API

## Встановлення

```bash
npm install
cp .env.example .env
# заповніть DB_* та інші змінні; для SSL потрібен ca.pem у корені проєкту
npm run build
npm run start:dev
```

- API: `http://localhost:3002/api`
- Swagger: `http://localhost:3002/api/docs`

## Змінні середовища (`.env`)

| Змінна | Опис |
|--------|------|
| `PORT` | Порт сервера (за замовч. `3002`) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL |
| `DB_SSL` | `true` / `false` |
| `DB_CA_PATH` | Шлях до CA-сертифіката, напр. `./ca.pem` |
| `JWT_SECRET` | Секрет (legacy; основна auth — Firebase) |
| `ADMIN_EMAIL` | Email, якому при першому вході може бути призначено admin |

## Скрипти

```bash
npm run start:dev    # розробка з hot reload
npm run build        # компіляція TypeScript → dist/
npm run start:prod   # node dist/main.js

npm run migration:run    # застосувати міграції
npm run migration:revert # відкотити останню міграцію
npm run db:seed          # тестові дані
npm run db:verify        # перевірка seed
```

## Основні модулі API

| Префікс | Призначення |
|---------|-------------|
| `GET/POST …/graph-edit-maps` | CRUD карт, редактор, publish, import/export JSON |
| `GET …/users/me`, `/users/me/cabinet` | Профіль і кабінет |
| `GET …/users/:id/profile` | Публічний профіль автора |
| `GET …/users/me/teaching/*` | Статистика викладача |
| `…/progress` | Прогрес проходження тем |
| `…/nodes`, `…/topics` | Вузли та теми |
| `…/admin/statistics` | Агрегована статистика (admin) |

Авторизація: заголовок `Authorization: Bearer <Firebase ID token>`.

## Frontend

Клієнт — у папці **`../graphedit/`**. У `.env` фронтенду:

```
VITE_API_BASE_URL=http://localhost:3002/api
```

## Міграції

Схема БД керується через TypeORM migrations у `src/migrations/`.  
Нові міграції додавайте лише за потреби; для дипломного демо достатньо `migration:run` на існуючій базі.
