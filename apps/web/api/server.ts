import "dotenv/config";

import { createApp } from "./app.js";
import { database } from "./db/client.js";
import { RefreshTokenModel } from "./model/refreshToken.model.js";
import { UserModel } from "./model/user.model.js";
import { ArticleModel } from "./model/article.model.js";
import { AuthService } from "./service/auth.service.js";
import { ArticleService } from "./service/article.service.js";

const authService = new AuthService(
  new UserModel(database),
  new RefreshTokenModel(database),
);
const articleService = new ArticleService(new ArticleModel(database));
const app = createApp(authService, articleService);
const port = Number.parseInt(process.env["PORT"] ?? "3000", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

app.listen(port, () => {
  console.log(`Quiescent API listening on port ${port}`);
});
