"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../db";
import { requireStore, requireUser } from "../auth/session";
import { createStore, getStoreForOwner, updateStore } from "../services/stores";
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
import { uploadStoreImage } from "../storage";
import {
  categorySchema,
  deliveryZoneSchema,
  orderStatusSchema,
  paymentToggleSchema,
  productSchema,
  storeSchema,
} from "@/lib/validation";
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
    await createStore(db(), user.id, storeInputFromForm(fd));
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
    if (logo instanceof File && logo.size > 0) logoUrl = (await uploadStoreImage(store.id, logo)).url;
    if (fd.get("removeLogo") === "1") logoUrl = null;
    await updateStore(db(), store.id, { ...input, logoUrl });
    revalidatePath("/dashboard", "layout");
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
  });
}

export async function saveProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const input = productInputFromForm(fd);
    const id = emptyToNull(fd.get("id"));
    if (id) await updateProduct(db(), store.id, uuid.parse(id), input);
    else await createProduct(db(), store.id, input);
    revalidatePath("/dashboard/products");
    revalidatePath(`/s/${store.slug}`);
  } catch (e) {
    return toActionState(e);
  }
  redirect("/dashboard/products");
}

export async function toggleProductAction(id: string, isActive: boolean) {
  const { store } = await requireStore();
  await setProductActive(db(), store.id, uuid.parse(id), z.boolean().parse(isActive));
  revalidatePath("/dashboard/products");
  revalidatePath(`/s/${store.slug}`);
}

export async function deleteProductAction(id: string) {
  const { store } = await requireStore();
  await deleteProduct(db(), store.id, uuid.parse(id));
  revalidatePath("/dashboard/products");
  revalidatePath(`/s/${store.slug}`);
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
    revalidatePath("/dashboard/categories");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function deleteCategoryAction(id: string) {
  const { store } = await requireStore();
  await deleteCategory(db(), store.id, uuid.parse(id));
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
    revalidatePath("/dashboard/delivery");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function deleteZoneAction(id: string) {
  const { store } = await requireStore();
  await deleteZone(db(), store.id, uuid.parse(id));
  revalidatePath("/dashboard/delivery");
}

// ---------------------------------------------------------------- payments
export async function togglePaymentAction(method: string, enabled: boolean) {
  const { store } = await requireStore();
  const input = paymentToggleSchema.parse({ method, enabled });
  await setPaymentMethod(db(), store.id, input.method, input.enabled);
  revalidatePath("/dashboard/payments");
}

// ---------------------------------------------------------------- orders
export async function updateOrderStatusAction(orderId: string, status: string): Promise<ActionState> {
  try {
    const { store, user } = await requireStore();
    const input = orderStatusSchema.parse({ orderId, status });
    await updateOrderStatus(db(), store.id, input.orderId, input.status, user.id);
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
    revalidatePath("/dashboard/products");
    revalidatePath(`/s/${store.slug}`);
    return { ok: true, count: list.length };
  } catch (e) {
    return toActionState(e);
  }
}
