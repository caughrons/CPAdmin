import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Archive";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import EditIcon from "@mui/icons-material/Edit";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import firebase from "firebase/app";
import "firebase/firestore";
import { firebaseConfig } from "@/config";
import {
  upsertCategory,
  upsertProduct,
  archiveProduct,
  setFeaturedProduct,
  clearFeaturedProduct,
  rebuildCatalogState,
  uploadProductImage,
  setOrderFulfilled,
  deleteOrders,
} from "@/services/shopAdmin";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf",
  "ugx","vnd","vuv","xaf","xof","xpf",
]);

function displayAmount(amount, currency) {
  if (!amount || !currency) return "";
  const code = currency.toLowerCase();
  const value = ZERO_DECIMAL_CURRENCIES.has(code) ? amount : amount / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code.toUpperCase(),
    }).format(value);
  } catch {
    return `${code.toUpperCase()} ${value}`;
  }
}

function amountToStripeMinorUnits(value, currency) {
  const code = (currency || "").toLowerCase();
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  return ZERO_DECIMAL_CURRENCIES.has(code) ? Math.round(num) : Math.round(num * 100);
}

function stripeMinorUnitsToDisplay(amount, currency) {
  const code = (currency || "").toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return String(amount);
  return (amount / 100).toFixed(2);
}

// ── Global Status Panel ───────────────────────────────────────────────────────

function GlobalStatusPanel() {
  const [values, setValues] = useState({
    enabled: false,
    useStripeTest: true,
    stripePublishableKey: "",
    stripeTestPublishableKey: "",
  });
  const [computed, setComputed] = useState({ hasMerchandise: false, catalogCount: 0, featuredProductId: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const doc = await db.collection("app_config").doc("shop").get();
      const d = doc.data() ?? {};
      setValues({
        enabled: d.enabled ?? false,
        useStripeTest: d.useStripeTest ?? true,
        stripePublishableKey: d.stripePublishableKey ?? "",
        stripeTestPublishableKey: d.stripeTestPublishableKey ?? "",
      });
      setComputed({
        hasMerchandise: d.hasMerchandise ?? false,
        catalogCount: d.catalogCount ?? 0,
        featuredProductId: d.featuredProductId ?? null,
      });
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await db.collection("app_config").doc("shop").set(
        {
          enabled: values.enabled,
          useStripeTest: values.useStripeTest,
          stripePublishableKey: values.stripePublishableKey.trim() || null,
          stripeTestPublishableKey: values.stripeTestPublishableKey.trim() || null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      setSuccess(true);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    setError(null);
    try {
      const result = await rebuildCatalogState();
      setComputed((prev) => ({
        ...prev,
        catalogCount: result.catalogCount,
        hasMerchandise: result.hasMerchandise,
      }));
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>Global Shop Status</Typography>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">Saved.</Alert>}

          <Box display="flex" gap={4} flexWrap="wrap">
            <Box>
              <Typography variant="caption" color="text.secondary">Merchandise count (computed)</Typography>
              <Typography variant="h4">{computed.catalogCount}</Typography>
              <Typography variant="caption" color={computed.hasMerchandise ? "success.main" : "text.secondary"}>
                {computed.hasMerchandise ? "Shop tile visible in app" : "Shop tile hidden in app"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Featured product ID</Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                {computed.featuredProductId ?? "—"}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <FormControlLabel
              control={<Switch checked={values.enabled} onChange={(e) => setValues((v) => ({ ...v, enabled: e.target.checked }))} />}
              label="Shop enabled (kill switch)"
            />
            <FormControlLabel
              control={<Switch checked={values.useStripeTest} onChange={(e) => setValues((v) => ({ ...v, useStripeTest: e.target.checked }))} />}
              label="Use Stripe test mode"
            />
          </Box>

          <Box display="grid" gap={2} gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }}>
            <TextField
              label="Live publishable key (pk_live_...)"
              value={values.stripePublishableKey}
              onChange={(e) => setValues((v) => ({ ...v, stripePublishableKey: e.target.value }))}
              helperText="Safe to store — never enter your secret key here."
              size="small"
            />
            <TextField
              label="Test publishable key (pk_test_...)"
              value={values.stripeTestPublishableKey}
              onChange={(e) => setValues((v) => ({ ...v, stripeTestPublishableKey: e.target.value }))}
              helperText="Used when test mode is on."
              size="small"
            />
          </Box>

          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button variant="outlined" size="small" onClick={handleRebuild} disabled={rebuilding}>
              {rebuilding ? "Rebuilding…" : "Rebuild Catalog Count"}
            </Button>
            <Button variant="outlined" onClick={load} disabled={saving}>Reload</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </Box>
        </Stack>
      )}
    </Paper>
  );
}

// ── Category CRUD ─────────────────────────────────────────────────────────────

const EMPTY_CAT = { categoryId: "", name: "", slug: "", sortOrder: 0 };

function CategoriesPanel() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null); // null | { ...EMPTY_CAT }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await db.collection("shop_categories").orderBy("sortOrder").get();
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => setDialog({ ...EMPTY_CAT });
  const openEdit = (cat) => setDialog({
    categoryId: cat.id,
    name: cat.name ?? "",
    slug: cat.slug ?? "",
    sortOrder: cat.sortOrder ?? 0,
  });

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await upsertCategory(dialog);
      setDialog(null);
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (cat) => {
    if (!window.confirm(`Archive category "${cat.name}"?`)) return;
    try {
      await upsertCategory({ categoryId: cat.id, name: cat.name, slug: cat.slug, active: false, sortOrder: cat.sortOrder });
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Categories</Typography>
        <Button variant="contained" size="small" onClick={openAdd}>Add Category</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <CircularProgress size={20} /> : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell>Order</TableCell>
              <TableCell>Active</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell>{cat.name}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{cat.slug}</TableCell>
                <TableCell>{cat.sortOrder}</TableCell>
                <TableCell>
                  <Chip label={cat.active !== false ? "Active" : "Archived"} size="small"
                    color={cat.active !== false ? "success" : "default"} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(cat)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Archive"><IconButton size="small" onClick={() => handleArchive(cat)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center">No categories yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog?.categoryId ? "Edit Category" : "Add Category"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Name" value={dialog?.name ?? ""} onChange={(e) => setDialog((d) => ({ ...d, name: e.target.value }))} required />
            <TextField label="Slug" value={dialog?.slug ?? ""} onChange={(e) => setDialog((d) => ({ ...d, slug: e.target.value }))}
              helperText="URL-safe identifier, e.g. apparel" />
            <TextField label="Sort order" type="number" value={dialog?.sortOrder ?? 0}
              onChange={(e) => setDialog((d) => ({ ...d, sortOrder: parseInt(e.target.value, 10) || 0 }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

// ── Product Image Upload ──────────────────────────────────────────────────────

function ProductImageUpload({ imageUrl, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = React.useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadProductImage(file);
      onUploaded(url);
    } catch (err) {
      setError(err?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>Product Image</Typography>
      <Box display="flex" alignItems="center" gap={2}>
        {imageUrl && (
          <Box
            component="img"
            src={imageUrl}
            alt="Product"
            sx={{ width: 80, height: 80, objectFit: "cover", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
          />
        )}
        <Box>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : imageUrl ? "Replace Image" : "Upload Image"}
          </Button>
          {imageUrl && (
            <Button size="small" color="error" onClick={() => onUploaded("")} sx={{ ml: 1 }}>
              Remove
            </Button>
          )}
        </Box>
      </Box>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  );
}

// ── Product CRUD ──────────────────────────────────────────────────────────────

const STANDARD_SHIRT_COLORS = [
  "Black", "White", "Navy", "Royal Blue", "Light Blue", "Red", "Maroon",
  "Forest Green", "Kelly Green", "Purple", "Orange", "Gold", "Pink",
  "Charcoal", "Sport Grey", "Sand",
];

const STANDARD_SHIRT_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];

const EMPTY_VARIANT = { priceId: "", color: "", size: "", amount: "" };

const EMPTY_PRODUCT = {
  productId: "",
  stripeProductId: "",
  name: "",
  description: "",
  imageUrl: "",
  categoryIds: [],
  featured: false,
  active: true,
  requiresShipping: false,
  sortOrder: 0,
  currency: "usd",
  variants: [{ ...EMPTY_VARIANT }],
  selectedColors: [],
  selectedSizes: [],
  includeTall: false,
  defaultVariantPrice: "",
};

function ProductsPanel() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [featuredId, setFeaturedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prodSnap, catSnap, configDoc] = await Promise.all([
        db.collection("shop_catalog").orderBy("sortOrder").get(),
        db.collection("shop_categories").where("active", "==", true).get(),
        db.collection("app_config").doc("shop").get(),
      ]);
      setProducts(prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFeaturedId(configDoc.data()?.featuredProductId ?? null);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => setDialog({ ...EMPTY_PRODUCT, variants: [{ ...EMPTY_VARIANT }] });
  const openEdit = (p) => {
    const prices = p.prices?.length ? p.prices : [{}];
    const currency = prices[0]?.currency ?? "usd";
    const sizesUsed = prices.map((price) => price.size).filter(Boolean);
    setDialog({
      productId: p.id,
      stripeProductId: p.stripeProductId ?? "",
      name: p.name ?? "",
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? "",
      categoryIds: p.categoryIds ?? [],
      featured: p.featured ?? false,
      active: p.active ?? true,
      requiresShipping: p.requiresShipping ?? false,
      sortOrder: p.sortOrder ?? 0,
      currency,
      variants: prices.map((price) => ({
        priceId: price.priceId ?? "",
        color: price.color ?? "",
        size: price.size ?? "",
        amount: stripeMinorUnitsToDisplay(price.amount ?? 0, price.currency ?? currency),
      })),
      selectedColors: [...new Set(prices.map((price) => price.color).filter((c) => STANDARD_SHIRT_COLORS.includes(c)))],
      selectedSizes: [...new Set(sizesUsed
        .map((s) => (s.endsWith("T") && STANDARD_SHIRT_SIZES.includes(s.slice(0, -1)) ? s.slice(0, -1) : s))
        .filter((s) => STANDARD_SHIRT_SIZES.includes(s)))],
      includeTall: sizesUsed.some((s) => s.endsWith("T") && STANDARD_SHIRT_SIZES.includes(s.slice(0, -1))),
      defaultVariantPrice: "",
    });
  };

  const updateVariant = (index, patch) => {
    setDialog((d) => ({
      ...d,
      variants: d.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  };

  const addVariant = () => {
    setDialog((d) => ({ ...d, variants: [...d.variants, { ...EMPTY_VARIANT }] }));
  };

  const toggleSelected = (key, value) => {
    setDialog((d) => {
      const list = d[key] ?? [];
      return { ...d, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  };

  const generateVariants = () => {
    setDialog((d) => {
      const colors = d.selectedColors.length ? d.selectedColors : [""];
      const baseSizes = d.selectedSizes.length ? d.selectedSizes : [""];
      const sizeEntries = [];
      for (const s of baseSizes) {
        sizeEntries.push(s);
        if (d.includeTall && s) sizeEntries.push(`${s}T`);
      }

      const isBlankPlaceholder = d.variants.length === 1
        && !d.variants[0].color && !d.variants[0].size
        && !d.variants[0].amount && !d.variants[0].priceId;
      const baseVariants = isBlankPlaceholder ? [] : d.variants;

      const existingKeys = new Set(baseVariants.map((v) => `${v.color.toLowerCase()}::${v.size.toLowerCase()}`));
      const newRows = [];
      for (const c of colors) {
        for (const s of sizeEntries) {
          const key = `${c.toLowerCase()}::${s.toLowerCase()}`;
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          newRows.push({ priceId: "", color: c, size: s, amount: d.defaultVariantPrice || "" });
        }
      }

      return newRows.length ? { ...d, variants: [...baseVariants, ...newRows] } : d;
    });
  };

  const removeVariant = (index) => {
    setDialog((d) => ({ ...d, variants: d.variants.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const currency = dialog.currency.toLowerCase().trim();
      const variants = dialog.variants.map((v) => ({
        priceId: v.priceId || undefined,
        color: v.color.trim() || undefined,
        size: v.size.trim() || undefined,
        amount: amountToStripeMinorUnits(v.amount, currency),
      }));
      await upsertProduct({
        ...dialog,
        currency,
        variants,
      });
      setDialog(null);
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (p) => {
    if (!window.confirm(`Archive product "${p.name}"? It will no longer appear in the app.`)) return;
    try {
      await archiveProduct(p.id);
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  };

  const handleSetFeatured = async (productId) => {
    try {
      if (featuredId === productId) {
        await clearFeaturedProduct();
        setFeaturedId(null);
      } else {
        await setFeaturedProduct(productId);
        setFeaturedId(productId);
      }
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  };

  const toggleCategoryId = (id) => {
    setDialog((d) => ({
      ...d,
      categoryIds: d.categoryIds.includes(id)
        ? d.categoryIds.filter((c) => c !== id)
        : [...d.categoryIds, id],
    }));
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Products</Typography>
        <Button variant="contained" size="small" onClick={openAdd}>Add Product</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <CircularProgress size={20} /> : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Featured</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Categories</TableCell>
              <TableCell>Shipping</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((p) => {
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Tooltip title={featuredId === p.id ? "Remove featured" : "Set as featured"}>
                      <IconButton size="small" onClick={() => handleSetFeatured(p.id)}>
                        {featuredId === p.id
                          ? <StarIcon fontSize="small" color="warning" />
                          : <StarBorderIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                      {p.stripeProductId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const prices = p.prices ?? [];
                      if (prices.length === 0) return "—";
                      if (prices.length === 1) return displayAmount(prices[0].amount, prices[0].currency);
                      const amounts = prices.map((pr) => pr.amount);
                      const min = Math.min(...amounts);
                      const max = Math.max(...amounts);
                      const currency = prices[0].currency;
                      return min === max
                        ? `${displayAmount(min, currency)} · ${prices.length} variants`
                        : `${displayAmount(min, currency)}–${displayAmount(max, currency)} · ${prices.length} variants`;
                    })()}
                  </TableCell>
                  <TableCell>
                    {(p.categoryIds ?? []).map((cid) => {
                      const cat = categories.find((c) => c.id === cid);
                      return cat ? <Chip key={cid} label={cat.name} size="small" sx={{ mr: 0.5 }} /> : null;
                    })}
                  </TableCell>
                  <TableCell>{p.requiresShipping ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Chip
                      label={p.active ? "Active" : "Archived"}
                      size="small"
                      color={p.active ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    {p.active && (
                      <Tooltip title="Archive"><IconButton size="small" onClick={() => handleArchive(p)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {products.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center">No products yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle>{dialog?.productId ? "Edit Product" : "Add Product"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <Box display="grid" gap={2} gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }}>
              <TextField
                label="Product name"
                value={dialog?.name ?? ""}
                onChange={(e) => setDialog((d) => ({ ...d, name: e.target.value }))}
                required
              />
              <TextField
                label="Sort order"
                type="number"
                value={dialog?.sortOrder ?? 0}
                onChange={(e) => setDialog((d) => ({ ...d, sortOrder: parseInt(e.target.value, 10) || 0 }))}
              />
            </Box>

            <TextField
              label="Description"
              multiline
              rows={3}
              value={dialog?.description ?? ""}
              onChange={(e) => setDialog((d) => ({ ...d, description: e.target.value }))}
            />

            <ProductImageUpload
              imageUrl={dialog?.imageUrl ?? ""}
              onUploaded={(url) => setDialog((d) => ({ ...d, imageUrl: url }))}
            />

            <TextField
              label="Currency (ISO 4217)"
              value={dialog?.currency ?? "usd"}
              onChange={(e) => setDialog((d) => ({ ...d, currency: e.target.value.toLowerCase() }))}
              helperText="e.g. usd, eur, gbp, jpy, aud — shared by all variants below."
              sx={{ maxWidth: 240 }}
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>Colors &amp; Sizes</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Check the colors and sizes this product comes in, then Generate Variants to create a
                price row for every combination. Leave both unchecked for a single-option product.
              </Typography>

              <Typography variant="caption" fontWeight={600} display="block">Colors</Typography>
              <Box display="flex" flexWrap="wrap">
                {STANDARD_SHIRT_COLORS.map((c) => (
                  <FormControlLabel
                    key={c}
                    sx={{ width: { xs: "50%", sm: "33.33%", md: "25%" }, mr: 0 }}
                    control={
                      <Checkbox
                        size="small"
                        checked={dialog?.selectedColors?.includes(c) ?? false}
                        onChange={() => toggleSelected("selectedColors", c)}
                      />
                    }
                    label={c}
                  />
                ))}
              </Box>

              <Typography variant="caption" fontWeight={600} display="block" sx={{ mt: 1 }}>Sizes</Typography>
              <Box display="flex" flexWrap="wrap" alignItems="center">
                {STANDARD_SHIRT_SIZES.map((s) => (
                  <FormControlLabel
                    key={s}
                    sx={{ width: { xs: "33.33%", sm: "20%", md: "11%" }, mr: 0 }}
                    control={
                      <Checkbox
                        size="small"
                        checked={dialog?.selectedSizes?.includes(s) ?? false}
                        onChange={() => toggleSelected("selectedSizes", s)}
                      />
                    }
                    label={s}
                  />
                ))}
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={dialog?.includeTall ?? false}
                      onChange={(e) => setDialog((d) => ({ ...d, includeTall: e.target.checked }))}
                    />
                  }
                  label="Include Tall (adds a Tall version of each checked size, e.g. LT)"
                />
              </Box>

              <Box display="flex" gap={2} alignItems="center" sx={{ mt: 1.5 }}>
                <TextField
                  label="Default price for new variants"
                  size="small"
                  value={dialog?.defaultVariantPrice ?? ""}
                  onChange={(e) => setDialog((d) => ({ ...d, defaultVariantPrice: e.target.value }))}
                  helperText="Applied to generated rows; edit any row afterward."
                  sx={{ maxWidth: 260 }}
                />
                <Button variant="outlined" size="small" onClick={generateVariants}>
                  Generate Variants
                </Button>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>Variants &amp; Pricing</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Generated below from the Colors/Sizes checked above. You can also add, edit, or
                remove rows directly — e.g. for a one-off color or size not in the standard lists.
              </Typography>
              <Stack spacing={1.5}>
                {dialog?.variants?.map((v, i) => (
                  <Box key={i} display="grid" gap={1} gridTemplateColumns="1fr 1fr 1fr auto" alignItems="center">
                    <TextField
                      label="Color (optional)"
                      size="small"
                      value={v.color}
                      onChange={(e) => updateVariant(i, { color: e.target.value })}
                    />
                    <TextField
                      label="Size (optional)"
                      size="small"
                      value={v.size}
                      onChange={(e) => updateVariant(i, { size: e.target.value })}
                    />
                    <TextField
                      label="Price amount"
                      size="small"
                      value={v.amount}
                      onChange={(e) => updateVariant(i, { amount: e.target.value })}
                      helperText={
                        i === 0
                          ? ZERO_DECIMAL_CURRENCIES.has((dialog?.currency ?? "").toLowerCase())
                            ? "Full units (e.g. 999 = ¥999)"
                            : "Major units (e.g. 9.99)"
                          : undefined
                      }
                      required
                    />
                    <Tooltip title="Remove variant">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => removeVariant(i)}
                          disabled={dialog.variants.length <= 1}
                        >
                          <RemoveCircleOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                ))}
              </Stack>
              <Button size="small" onClick={addVariant} sx={{ mt: 1 }}>+ Add Variant</Button>
            </Box>

            <Typography variant="subtitle2">Categories</Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {categories.map((cat) => (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  clickable
                  color={dialog?.categoryIds?.includes(cat.id) ? "primary" : "default"}
                  onClick={() => toggleCategoryId(cat.id)}
                />
              ))}
              {categories.length === 0 && <Typography variant="caption">No active categories.</Typography>}
            </Box>

            <Box display="flex" gap={3} flexWrap="wrap">
              <FormControlLabel
                control={<Switch checked={dialog?.active ?? true} onChange={(e) => setDialog((d) => ({ ...d, active: e.target.checked }))} />}
                label="Active (visible in app)"
              />
              <FormControlLabel
                control={<Switch checked={dialog?.requiresShipping ?? false} onChange={(e) => setDialog((d) => ({ ...d, requiresShipping: e.target.checked }))} />}
                label="Requires shipping address at checkout"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : dialog?.productId ? "Update Product" : "Create Product"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────

const ORDER_STATUS_COLOR = {
  succeeded: "success",
  pending: "default",
  failed: "error",
  refunded: "secondary",
};

function orderLineItems(order, productsById) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.map((item) => ({
      name: item.name ?? "Item",
      label: item.priceLabel && item.priceLabel !== "Default" ? item.priceLabel : null,
      quantity: item.quantity ?? 1,
      lineTotal: item.lineTotal ?? 0,
      currency: item.currency ?? order.currency,
    }));
  }
  const product = productsById[order.productId];
  const priceEntry = product?.prices?.find((p) => p.priceId === order.priceId);
  return [{
    name: product?.name ?? "Item",
    label: priceEntry?.label && priceEntry.label !== "Default" ? priceEntry.label : null,
    quantity: 1,
    lineTotal: order.amount ?? 0,
    currency: order.currency,
  }];
}

function OrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [productsById, setProductsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState({});
  const [unfulfilledOnly, setUnfulfilledOnly] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orderSnap, prodSnap] = await Promise.all([
        db.collection("shop_orders").orderBy("createdAt", "desc").limit(200).get(),
        db.collection("shop_catalog").get(),
      ]);
      setOrders(orderSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const byId = {};
      prodSnap.docs.forEach((d) => { byId[d.id] = { id: d.id, ...d.data() }; });
      setProductsById(byId);
      setSelected(new Set());
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleFulfilled = async (order) => {
    const next = !order.fulfilled;
    setUpdating((u) => ({ ...u, [order.id]: true }));
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, fulfilled: next } : o)));
    try {
      await setOrderFulfilled(order.id, next);
    } catch (e) {
      setError(e?.message ?? String(e));
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, fulfilled: !next } : o)));
    } finally {
      setUpdating((u) => ({ ...u, [order.id]: false }));
    }
  };

  const visibleOrders = unfulfilledOnly ? orders.filter((o) => !o.fulfilled) : orders;
  const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((o) => selected.has(o.id));
  const someVisibleSelected = visibleOrders.some((o) => selected.has(o.id));

  const toggleOrderSelected = (orderId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        visibleOrders.forEach((o) => next.delete(o.id));
        return next;
      }
      const next = new Set(prev);
      visibleOrders.forEach((o) => next.add(o.id));
      return next;
    });
  };

  // TODO(pre-launch): bulk order deletion is only here to wipe test/junk
  // orders during QA. It permanently destroys payment/audit records
  // (shopDeleteOrders bypasses Firestore rules via the Admin SDK). Before the
  // shop goes live, either remove this button, restrict it to
  // pending/failed orders, or add a stronger confirmation step.
  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Permanently delete ${ids.length} order${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteOrders(ids);
      setOrders((prev) => prev.filter((o) => !selected.has(o.id)));
      setSelected(new Set());
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h6">Orders</Typography>
        <Box display="flex" gap={2} alignItems="center">
          {selected.size > 0 && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : `Delete Selected (${selected.size})`}
            </Button>
          )}
          <FormControlLabel
            control={<Switch checked={unfulfilledOnly} onChange={(e) => setUnfulfilledOnly(e.target.checked)} />}
            label="Unfulfilled only"
          />
          <Button variant="outlined" size="small" onClick={load} disabled={loading}>Reload</Button>
        </Box>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <CircularProgress size={20} /> : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected && !allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                </TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Filled</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleOrders.map((order) => {
                const items = orderLineItems(order, productsById);
                return (
                  <TableRow key={order.id} selected={selected.has(order.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selected.has(order.id)}
                        onChange={() => toggleOrderSelected(order.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={order.id}>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                          {order.id.slice(0, 14)}…
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                        {order.uid ? `${order.uid.slice(0, 10)}…` : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {items.map((item, i) => (
                        <Typography key={i} variant="body2">
                          {item.quantity}× {item.name}{item.label ? ` (${item.label})` : ""}
                        </Typography>
                      ))}
                    </TableCell>
                    <TableCell>{displayAmount(order.amount, order.currency)}</TableCell>
                    <TableCell>
                      <Chip
                        label={order.status ?? "unknown"}
                        size="small"
                        color={ORDER_STATUS_COLOR[order.status] ?? "default"}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={order.fulfilled === true}
                        onChange={() => handleToggleFulfilled(order)}
                        disabled={updating[order.id]}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {visibleOrders.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center">No orders yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

function Ecommerce() {
  const [tab, setTab] = useState(0);
  return (
    <React.Fragment>
      <Helmet title="Ecommerce" />
      <Box display="flex" flexDirection="column" gap={3}>
        <Box>
          <Typography variant="h4" gutterBottom>Ecommerce</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage the CruisaPalooza merchandise shop. Products and prices are created in Stripe
            via the backend. Set{" "}
            <strong>enabled = true</strong> in Global Status once products are ready.
          </Typography>
        </Box>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Status" />
          <Tab label="Categories" />
          <Tab label="Products" />
          <Tab label="Orders" />
        </Tabs>
        {tab === 0 && <GlobalStatusPanel />}
        {tab === 1 && <CategoriesPanel />}
        {tab === 2 && <ProductsPanel />}
        {tab === 3 && <OrdersPanel />}
      </Box>
    </React.Fragment>
  );
}

export default Ecommerce;
