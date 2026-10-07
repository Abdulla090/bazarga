"use server";
import { revalidatePath } from "next/cache";
import { invalidateCatalog, invalidateStore } from "../cache/tags";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../db";
import { requireStore, requireUser } from "../auth/session";
import { createStore, getStoreForOwner, updateStore, updateStoreStorefront, updateStoreTheme } from "../services/stores";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  setProductActive,
  updateCategory,
  updateProduct,
} from "../services/catalog";
import { deleteZone, setPaymentMethod, updateZoneFee, upsertZone } from "../services/settings";
import { updateOrderStatus } from "../services/orders";
import { uploadProcessedImage } from "../storage";
import {
  categorySchema,
  deliveryZoneSchema,
  orderStatusSchema,
  paymentToggleSchema,
  productSchema,
  storeSchema,
  storeThemeSchema,
  storeStorefrontSchema,
} from "@/lib/validation";
import { RESTOCK_ON } from "@/lib/order-status";
import { emptyToNull, formObject, localizedFromForm, toActionState, type ActionState } from "./util";

const uuid = z.uuid();

// ---------------------------------------------------------------- store
function storeInputFromForm(fd: FormData) {
  const o = formObject(fd);
  return storeSchema.parse({
    name: o.name,
    slug: o.slug,
    defaultLocale: o.defaultLocale,
    phone: o.phone || undefined,
    whatsapp: o.whatsapp || undefined,
    instagram: o.instagram || undefined,
    city: o.city || undefined,
    tagline: localizedFromForm(fd, "tagline"),
  });
}

export async function createStoreAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    if (await getStoreForOwner(db(), user.id)) redirect("/dashboard");
    const created = await createStore(db(), user.id, storeInputFromForm(fd));
    // The slug may have been looked up (and cached as "no such store") before it was taken.
    invalidateStore(created.id, [created.slug]);
  } catch (e) {
    return toActionState(e);
  }
  redirect("/dashboard");
}

export async function updateStoreAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const input = storeInputFromForm(fd);
    let logoUrl: string | null | undefined;
    const logo = fd.get("logo");
    if (logo instanceof File && logo.size > 0) logoUrl = (await uploadProcessedImage(store.id, logo)).url;
    if (fd.get("removeLogo") === "1") logoUrl = null;
    await updateStore(db(), store.id, { ...input, logoUrl });
    invalidateStore(store.id, [store.slug, input.slug]);
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function saveThemeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const input = storeThemeSchema.parse({
      themePreset: fd.get("themePreset") ?? undefined,
      accentColor: typeof fd.get("accentColor") === "string" ? (fd.get("accentColor") as string) : undefined,
      about: localizedFromForm(fd, "about"),
      returnPolicy: localizedFromForm(fd, "returnPolicy"),
    });
    await updateStoreTheme(db(), store.id, input);
    invalidateStore(store.id);
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

/** Cover photo (uploaded client-side to /api/uploads first) + free-delivery threshold. */
export async function saveStorefrontAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const input = storeStorefrontSchema.parse({
      coverImageUrl: fd.get("coverImageUrl") ?? null,
      coverImagePlaceholder: fd.get("coverImagePlaceholder") ?? null,
      freeDeliveryThreshold: fd.get("freeDeliveryThreshold") ?? null,
    });
    await updateStoreStorefront(db(), store.id, input);
    invalidateStore(store.id, [store.slug]);
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

// ---------------------------------------------------------------- products
function productInputFromForm(fd: FormData) {
  return productSchema.parse({
    name: localizedFromForm(fd, "name"),
    description: localizedFromForm(fd, "description"),
    price: fd.get("price"),
    compareAtPrice: emptyToNull(fd.get("compareAtPrice")),
    stock: emptyToNull(fd.get("stock")),
    categoryId: emptyToNull(fd.get("categoryId")),
    isActive: fd.get("isActive") === "on" || fd.get("isActive") === "true",
    imageUrls: fd.getAll("imageUrls").filter((v): v is string => typeof v === "string" && v.length > 0),
    images: imagesFromForm(fd),
  });
}

/** `images` hidden inputs carry pipeline metadata as JSON (validated by productImageSchema). */
function imagesFromForm(fd: FormData): unknown[] | undefined {
  const raw = fd.getAll("images").filter((v): v is string => typeof v === "string" && v.length > 0);
  if (!raw.length) return undefined;
  return raw.map((v) => {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      return null; // rejected by the schema → field error
    }
  });
}

export async function saveProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const input = productInputFromForm(fd);
    const id = emptyToNull(fd.get("id"));
    const saved = id ? await updateProduct(db(), store.id, uuid.parse(id), input) : await createProduct(db(), store.id, input);
    invalidateCatalog(store.id, [saved.id]);
    revalidatePath("/dashboard/products");
  } catch (e) {
    return toActionState(e);
  }
  redirect("/dashboard/products");
}

export async function toggleProductAction(id: string, isActive: boolean) {
  const { store } = await requireStore();
  await setProductActive(db(), store.id, uuid.parse(id), z.boolean().parse(isActive));
  invalidateCatalog(store.id, [id]);
  revalidatePath("/dashboard/products");
}

export async function deleteProductAction(id: string) {
  const { store } = await requireStore();
  await deleteProduct(db(), store.id, uuid.parse(id));
  invalidateCatalog(store.id, [id]);
  revalidatePath("/dashboard/products");
  redirect("/dashboard/products");
}

// ---------------------------------------------------------------- categories
export async function saveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const input = categorySchema.parse({ name: localizedFromForm(fd, "name"), sort: fd.get("sort") ?? 0 });
    const id = emptyToNull(fd.get("id"));
    if (id) await updateCategory(db(), store.id, uuid.parse(id), input);
    else await createCategory(db(), store.id, input);
    invalidateCatalog(store.id);
    revalidatePath("/dashboard/categories");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function deleteCategoryAction(id: string) {
  const { store } = await requireStore();
  await deleteCategory(db(), store.id, uuid.parse(id));
  invalidateCatalog(store.id);
  revalidatePath("/dashboard/categories");
}

// ---------------------------------------------------------------- delivery
export async function updateZoneAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const data = z
      .object({ id: uuid, fee: z.coerce.number().int().min(0).max(1_000_000), isActive: z.boolean() })
      .parse({ id: fd.get("id"), fee: fd.get("fee"), isActive: fd.get("isActive") === "on" });
    await updateZoneFee(db(), store.id, data.id, data.fee, data.isActive);
    invalidateStore(store.id);
    revalidatePath("/dashboard/delivery");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function addZoneAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const input = deliveryZoneSchema.parse({
      cityKey: fd.get("cityKey"),
      name: localizedFromForm(fd, "name"),
      fee: fd.get("fee"),
      isActive: true,
    });
    await upsertZone(db(), store.id, input);
    invalidateStore(store.id);
    revalidatePath("/dashboard/delivery");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function deleteZoneAction(id: string) {
  const { store } = await requireStore();
  await deleteZone(db(), store.id, uuid.parse(id));
  invalidateStore(store.id);
  revalidatePath("/dashboard/delivery");
}

// ---------------------------------------------------------------- payments
export async function togglePaymentAction(method: string, enabled: boolean) {
  const { store } = await requireStore();
  const input = paymentToggleSchema.parse({ method, enabled });
  await setPaymentMethod(db(), store.id, input.method, input.enabled);
  invalidateStore(store.id);
  revalidatePath("/dashboard/payments");
}

// ---------------------------------------------------------------- orders
export async function updateOrderStatusAction(orderId: string, status: string): Promise<ActionState> {
  try {
    const { store, user } = await requireStore();
    const input = orderStatusSchema.parse({ orderId, status });
    await updateOrderStatus(db(), store.id, input.orderId, input.status, user.id);
    // Cancelled / returned orders put stock back: product pages and "sold out" badges change.
    if (RESTOCK_ON.includes(input.status)) invalidateCatalog(store.id);
    revalidatePath(`/dashboard/orders/${input.orderId}`);
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

// ---------------------------------------------------------------- AI drafts → products
export async function createProductsFromDraftsAction(drafts: unknown): Promise<ActionState & { count?: number }> {
  try {
    const { store } = await requireStore();
    const list = z.array(z.unknown()).max(20).parse(drafts).map((d) => productSchema.parse(d));
    for (const p of list) await createProduct(db(), store.id, p);
    invalidateCatalog(store.id);
    revalidatePath("/dashboard/products");
    return { ok: true, count: list.length };
  } catch (e) {
    return toActionState(e);
  }
}
