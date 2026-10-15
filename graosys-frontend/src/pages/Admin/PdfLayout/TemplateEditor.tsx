import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/services/api";
import { toast } from "sonner";
import { LANGUAGE_LABELS } from ".";

const MAX_BYTES = 300 * 1024;
const PREVIEW_DELAY = 800;
const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const positions = [
  { value: "left", label: "Esquerda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Direita" },
];
const TABS = ["Geral", "Campos", "Cláusulas", "Rodapé", "Visual"] as const;
type Tab = (typeof TABS)[number];

type Lang = "pt-BR" | "en";
interface Field { key: string; visible: boolean; label: string | null }
interface Clause { id: string; title: string; body: string }
interface Template {
  id: string; name: string; language: Lang; is_default: boolean; active: boolean; contracts_count: number;
  title: string; fields: Field[]; show_fixations: boolean; clauses: Clause[]; closing_text: string; signatures: string[];
  logo_data: string | null; logo_position: string; logo_width: number;
  watermark_data: string | null; watermark_opacity: number; watermark_enabled: boolean;
}
interface Catalog {
  fields: { key: string; labels: Record<Lang, string> }[];
  variables: { key: string; label: string }[];
  defaults: Record<Lang, { title: string; closing_text: string; signatures: string[] }>;
  limits: { clauses: number; clause_body: number };
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

function ImagePicker({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);

  function onFile(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return toast.error("Use uma imagem PNG ou JPEG");
    if (file.size > MAX_BYTES) return toast.error("A imagem deve ter no máximo 300 KB");
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-40 items-center justify-center rounded-md border bg-muted/30">
          {value ? <img src={value} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sem imagem</span>}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>{value ? "Trocar" : "Enviar imagem"}</Button>
          {value && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange(null)}>Remover</Button>}
        </div>
        <input ref={ref} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

const move = <T,>(list: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export function AdminContractTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState<Template | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [tab, setTab] = useState<Tab>("Geral");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Imagens só vão para a API quando mudam (as duas juntas passam do limite do corpo da requisição).
  const imagesChanged = useRef(new Set<"logo_data" | "watermark_data">());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [sampleNumber, setSampleNumber] = useState("");
  const [role, setRole] = useState("Vendedor");
  // Último campo de texto com foco: é onde o botão de variável insere o {{...}}.
  const target = useRef<{ el: HTMLInputElement | HTMLTextAreaElement; set: (v: string) => void } | null>(null);

  useEffect(() => {
    api.get(`/api/contract-templates/${id}`).then((r) => setTpl(r.data)).catch((e) => toast.error(e.response?.data?.error || "Modelo não encontrado"));
    api.get("/api/contract-templates/catalog").then((r) => setCatalog(r.data)).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (patch: Partial<Template>) => { setTpl((t) => (t ? { ...t, ...patch } : t)); setDirty(true); };

  function payload(t: Template) {
    const body: Record<string, unknown> = {
      name: t.name, language: t.language, title: t.title, fields: t.fields, show_fixations: t.show_fixations,
      clauses: t.clauses, closing_text: t.closing_text, signatures: t.signatures,
      logo_position: t.logo_position, logo_width: t.logo_width, watermark_opacity: t.watermark_opacity, watermark_enabled: t.watermark_enabled,
    };
    for (const k of imagesChanged.current) body[k] = t[k];
    return body;
  }

  // Prévia ao vivo: gera o PDF do rascunho um pouco depois da última alteração.
  useEffect(() => {
    if (!tpl) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const r = await api.post("/api/contract-templates/preview",
          { ...payload(tpl), template_id: tpl.id, role, contract_number: sampleNumber.trim() || undefined },
          { responseType: "blob" });
        if (cancelled) return;
        setPreviewError("");
        setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(new Blob([r.data], { type: "application/pdf" })); });
      } catch (e: any) {
        if (cancelled) return;
        const data = e.response?.data;
        const text = data instanceof Blob ? await data.text().catch(() => "") : "";
        let message = "Erro ao gerar a prévia";
        try { message = JSON.parse(text).error || message; } catch { /* resposta sem JSON */ }
        setPreviewError(message);
      } finally { if (!cancelled) setPreviewing(false); }
    }, PREVIEW_DELAY);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tpl, role, sampleNumber]);

  async function save() {
    if (!tpl) return;
    setSaving(true);
    try {
      const r = await api.put(`/api/contract-templates/${tpl.id}`, payload(tpl));
      setTpl((t) => (t ? { ...t, ...r.data } : t));
      imagesChanged.current.clear();
      setDirty(false);
      toast.success("Modelo salvo");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Erro ao salvar o modelo");
    } finally { setSaving(false); }
  }

  // Trocar o idioma troca também os textos que ainda estão no padrão do idioma anterior.
  function changeLanguage(language: Lang) {
    if (!tpl || !catalog) return;
    const from = catalog.defaults[tpl.language];
    const to = catalog.defaults[language];
    const patch: Partial<Template> = { language };
    if (tpl.title === from.title) patch.title = to.title;
    if (tpl.closing_text === from.closing_text) patch.closing_text = to.closing_text;
    if (JSON.stringify(tpl.signatures) === JSON.stringify(from.signatures)) patch.signatures = [...to.signatures];
    update(patch);
  }

  function insertVariable(key: string) {
    const tag = `{{${key}}}`;
    const t = target.current;
    if (!t || !document.body.contains(t.el)) return toast.info("Clique no texto de uma cláusula ou do rodapé antes de inserir a variável");
    const { el } = t;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    // Renderiza já, para o cursor ir para depois da variável antes da próxima tecla.
    flushSync(() => t.set(el.value.slice(0, start) + tag + el.value.slice(end)));
    el.focus();
    el.setSelectionRange(start + tag.length, start + tag.length);
  }

  const track = (set: (v: string) => void) => ({
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { target.current = { el: e.currentTarget, set }; },
  });

  if (!tpl || !catalog) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const labels = Object.fromEntries(catalog.fields.map((f) => [f.key, f.labels[tpl.language]]));
  const setClause = (i: number, patch: Partial<Clause>) => update({ clauses: tpl.clauses.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const setField = (i: number, patch: Partial<Field>) => update({ fields: tpl.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  const variableBar = (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 text-xs text-muted-foreground">Clique para inserir no texto em edição. Use **texto** para negrito.</p>
      <div className="flex flex-wrap gap-1">
        {catalog.variables.map((v) => (
          <Button key={v.key} type="button" variant="outline" size="sm" className="h-7 px-2 font-mono text-xs" title={v.label}
            onMouseDown={(e) => e.preventDefault()} onClick={() => insertVariable(v.key)}>
            {`{{${v.key}}}`}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title={tpl.name || "Modelo de contrato"}
        description={`Modelo de contrato · ${LANGUAGE_LABELS[tpl.language]}${tpl.contracts_count ? ` · usado em ${tpl.contracts_count} contrato(s)` : ""}`}
        action={
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
            <Button variant="outline" onClick={() => navigate("/admin/pdf-layout")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
            <Button onClick={save} disabled={saving || !dirty}>{saving ? "Salvando..." : "Salvar modelo"}</Button>
          </div>
        }
      />
      <div className="grid flex-1 gap-6 p-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <div role="tablist" className="flex flex-wrap gap-1 border-b">
            {TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t}{t === "Cláusulas" && tpl.clauses.length > 0 ? ` (${tpl.clauses.length})` : ""}
              </button>
            ))}
          </div>

          {tab === "Geral" && (
            <Card><CardContent className="space-y-4 pt-6">
              <div className="flex gap-2">
                {tpl.is_default && <Badge>Padrão</Badge>}
                {!tpl.active && <Badge variant="secondary">Arquivado</Badge>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Nome do modelo</Label>
                <Input id="tpl-name" value={tpl.name} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-language">Idioma do PDF e do e-mail</Label>
                <select id="tpl-language" className={selectClass} value={tpl.language} onChange={(e) => changeLanguage(e.target.value as Lang)}>
                  {Object.entries(LANGUAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Muda os rótulos, as datas (01/10/2026 ↔ Oct 1, 2026) e os números (1.234,56 ↔ 1,234.56).</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-title">Título do documento</Label>
                <Input id="tpl-title" value={tpl.title} onChange={(e) => update({ title: e.target.value })} />
                <p className="text-xs text-muted-foreground">No PDF sai seguido da via: "{tpl.title} - {tpl.language === "en" ? "SELLER" : "VENDEDOR"}".</p>
              </div>
            </CardContent></Card>
          )}

          {tab === "Campos" && (
            <Card><CardContent className="space-y-3 pt-6">
              <p className="text-sm text-muted-foreground">Marque o que aparece na tabela do contrato, mude a ordem e, se quiser, troque o rótulo.</p>
              {tpl.fields.map((f, i) => (
                <div key={f.key} className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" aria-label={`Mostrar ${labels[f.key]}`} checked={f.visible} onChange={(e) => setField(i, { visible: e.target.checked })} />
                  <span className={`w-44 shrink-0 text-sm ${f.visible ? "" : "text-muted-foreground line-through"}`}>{labels[f.key]}</span>
                  <Input className="h-8" placeholder={labels[f.key]} aria-label={`Rótulo de ${labels[f.key]}`} value={f.label ?? ""} onChange={(e) => setField(i, { label: e.target.value || null })} />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Subir" disabled={i === 0} onClick={() => update({ fields: move(tpl.fields, i, -1) })}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Descer" disabled={i === tpl.fields.length - 1} onClick={() => update({ fields: move(tpl.fields, i, 1) })}><ArrowDown className="h-4 w-4" /></Button>
                </div>
              ))}
              <label className="flex items-center gap-2 border-t pt-4 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={tpl.show_fixations} onChange={(e) => update({ show_fixations: e.target.checked })} />
                Mostrar a tabela de fixações (contratos a fixar)
              </label>
            </CardContent></Card>
          )}

          {tab === "Cláusulas" && (
            <div className="space-y-4">
              {variableBar}
              {tpl.clauses.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma cláusula. Elas saem numeradas depois da tabela do contrato.</p>}
              {tpl.clauses.map((c, i) => (
                <Card key={c.id}><CardContent className="space-y-2 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-sm font-medium">{i + 1}.</span>
                    <Input aria-label={`Título da cláusula ${i + 1}`} placeholder="Título da cláusula" value={c.title}
                      onChange={(e) => setClause(i, { title: e.target.value })} {...track((v) => setClause(i, { title: v }))} />
                    <Button type="button" variant="ghost" size="icon" title="Subir" disabled={i === 0} onClick={() => update({ clauses: move(tpl.clauses, i, -1) })}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" title="Descer" disabled={i === tpl.clauses.length - 1} onClick={() => update({ clauses: move(tpl.clauses, i, 1) })}><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" title="Remover cláusula" className="text-destructive hover:text-destructive" onClick={() => update({ clauses: tpl.clauses.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <textarea aria-label={`Texto da cláusula ${i + 1}`} rows={5} maxLength={catalog.limits.clause_body} className={textareaClass} value={c.body}
                    onChange={(e) => setClause(i, { body: e.target.value })} {...track((v) => setClause(i, { body: v }))} />
                </CardContent></Card>
              ))}
              <Button type="button" variant="outline" disabled={tpl.clauses.length >= catalog.limits.clauses}
                onClick={() => update({ clauses: [...tpl.clauses, { id: newId(), title: "", body: "" }] })}>
                <Plus className="mr-2 h-4 w-4" />Adicionar cláusula
              </Button>
            </div>
          )}

          {tab === "Rodapé" && (
            <div className="space-y-4">
              {variableBar}
              <Card><CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="tpl-closing">Texto final</Label>
                  <textarea id="tpl-closing" rows={3} className={textareaClass} value={tpl.closing_text}
                    onChange={(e) => update({ closing_text: e.target.value })} {...track((v) => update({ closing_text: v }))} />
                </div>
                <div className="space-y-2">
                  <Label>Assinaturas</Label>
                  {tpl.signatures.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <Input aria-label={`Assinatura ${i + 1}`} value={s} onChange={(e) => update({ signatures: tpl.signatures.map((x, j) => (j === i ? e.target.value : x)) })} />
                      <Button type="button" variant="ghost" size="icon" title="Remover assinatura" onClick={() => update({ signatures: tpl.signatures.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  {tpl.signatures.length < 4 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => update({ signatures: [...tpl.signatures, ""] })}><Plus className="mr-2 h-4 w-4" />Adicionar assinatura</Button>
                  )}
                </div>
              </CardContent></Card>
            </div>
          )}

          {tab === "Visual" && (
            <Card><CardContent className="space-y-6 pt-6">
              <div className="space-y-4">
                <ImagePicker label="Logo (topo do contrato)" value={tpl.logo_data} onChange={(v) => { imagesChanged.current.add("logo_data"); update({ logo_data: v }); }} />
                <div className="space-y-2">
                  <Label>Posição do logo</Label>
                  <div className="flex gap-2">
                    {positions.map((p) => (
                      <Button key={p.value} type="button" size="sm" variant={tpl.logo_position === p.value ? "default" : "outline"} onClick={() => update({ logo_position: p.value })}>{p.label}</Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Largura do logo: {tpl.logo_width} pt</Label>
                  <input type="range" min={40} max={300} step={10} value={tpl.logo_width} onChange={(e) => update({ logo_width: Number(e.target.value) })} className="w-full" />
                </div>
              </div>
              <div className="space-y-4 border-t pt-6">
                <ImagePicker label="Marca d'água (centro da página)" value={tpl.watermark_data}
                  onChange={(v) => { imagesChanged.current.add("watermark_data"); update({ watermark_data: v, ...(v ? {} : { watermark_enabled: false }) }); }} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" disabled={!tpl.watermark_data} checked={tpl.watermark_enabled} onChange={(e) => update({ watermark_enabled: e.target.checked })} />
                  Usar marca d'água neste modelo
                </label>
                <div className="space-y-2">
                  <Label>Opacidade da marca d'água: {Math.round(tpl.watermark_opacity * 100)}%</Label>
                  <input type="range" min={0.03} max={0.5} step={0.01} value={tpl.watermark_opacity} onChange={(e) => update({ watermark_opacity: Number(e.target.value) })} className="w-full" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">PNG ou JPEG de até 300 KB cada. Para a marca d'água, prefira uma imagem com fundo transparente (PNG).</p>
            </CardContent></Card>
          )}
        </div>

        <div className="min-w-0 space-y-2 xl:sticky xl:top-4 xl:self-start">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="preview-contract" className="text-xs">Prévia com o contrato</Label>
              <Input id="preview-contract" className="h-8 w-48" placeholder="Exemplo (ou nº do contrato)" value={sampleNumber} onChange={(e) => setSampleNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="preview-role" className="text-xs">Via</Label>
              <select id="preview-role" className={`${selectClass} h-8 w-36 py-0`} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="Vendedor">Vendedor</option>
                <option value="Comprador">Comprador</option>
              </select>
            </div>
            {previewing && <Loader2 className="mb-2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {previewError && <p role="alert" className="text-sm text-destructive">{previewError}</p>}
          <div className="h-[75vh] overflow-hidden rounded-md border bg-muted/30">
            {previewUrl
              ? <iframe title="Prévia do PDF" src={previewUrl} className="h-full w-full" />
              : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Gerando prévia...</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
