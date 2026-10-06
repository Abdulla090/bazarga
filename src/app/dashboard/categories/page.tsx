import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { listCategories } from "@/server/services/catalog";
import { CategoryForm } from "./CategoryForms";

export default async function CategoriesPage() {
  const { store } = await requireStore();
  const t = await getTranslations("categories");
  const cats = await listCategories(db(), store.id);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <h2 className="font-bold">{t("new")}</h2>
      <CategoryForm />
      {cats.length === 0 ? <p className="text-ink-70">{t("empty")}</p> : cats.map((c) => <CategoryForm key={c.id} cat={{ id: c.id, name: c.name, sort: c.sort }} />)}
    </div>
  );
}
