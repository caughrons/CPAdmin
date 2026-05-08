import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
  Box,
  Button,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Archive";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import EditIcon from "@mui/icons-material/Edit";
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
  priceLabel: "Default",
  priceAmount: "",   // human-readable (e.g. "9.99" for USD, "999" for JPY)
  currency: "usd",
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

  const openAdd = () => setDialog({ ...EMPTY_PRODUCT });
  const openEdit = (p) => {
    const firstPrice = p.prices?.[0] ?? {};
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
      priceLabel: firstPrice.label ?? "Default",
      priceAmount: stripeMinorUnitsToDisplay(firstPrice.amount ?? 0, firstPrice.currency ?? "usd"),
      currency: firstPrice.currency ?? "usd",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const amount = amountToStripeMinorUnits(dialog.priceAmount, dialog.currency);
      await upsertProduct({
        ...dialog,
        amount,
        currency: dialog.currency.toLowerCase().trim(),
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
              const firstPrice = p.prices?.[0] ?? {};
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
                    {firstPrice.amount != null
                      ? displayAmount(firstPrice.amount, firstPrice.currency)
                      : "—"}
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

            <Typography variant="subtitle2">Pricing</Typography>
            <Box display="grid" gap={2} gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr 1fr" }}>
              <TextField
                label="Price amount"
                value={dialog?.priceAmount ?? ""}
                onChange={(e) => setDialog((d) => ({ ...d, priceAmount: e.target.value }))}
                helperText={
                  ZERO_DECIMAL_CURRENCIES.has((dialog?.currency ?? "").toLowerCase())
                    ? "Zero-decimal currency — enter full units (e.g. 999 = ¥999)."
                    : "Enter in major units (e.g. 9.99 = $9.99)."
                }
                required
              />
              <TextField
                label="Currency (ISO 4217)"
                value={dialog?.currency ?? "usd"}
                onChange={(e) => setDialog((d) => ({ ...d, currency: e.target.value.toLowerCase() }))}
                helperText="e.g. usd, eur, gbp, jpy, aud"
              />
              <TextField
                label="Price label"
                value={dialog?.priceLabel ?? "Default"}
                onChange={(e) => setDialog((d) => ({ ...d, priceLabel: e.target.value }))}
                helperText="Shown in variant selector (e.g. S, M, L or Default)."
              />
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

// ── Page root ─────────────────────────────────────────────────────────────────

function Ecommerce() {
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
        <GlobalStatusPanel />
        <CategoriesPanel />
        <ProductsPanel />
      </Box>
    </React.Fragment>
  );
}

export default Ecommerce;
