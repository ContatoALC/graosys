import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/services/api";

const MAX_BYTES = 300 * 1024;
const positions = [
  { value: "left", label: "Esquerda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Direita" },
];

function ImagePicker({ label, value, onChange, onError }: { label: string; value: string | null; onChange: (v: string | null) => void; onError: (m: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);

  function onFile(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return onError("Use uma imagem PNG ou JPEG");
    if (file.size > MAX_BYTES) return onError("A imagem deve ter no máximo 300 KB");
    const reader = new FileReader();
    reader.onload = () => { onError(""); onChange(reader.result as string); };
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

export function AdminPdfLayoutPage() {
  const [logo, setLogo] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState("left");
  const [logoWidth, setLogoWidth] = useState(120);
  const [watermark, setWatermark] = useState<string | null>(null);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.1);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    api.get("/api/pdf-settings").then((r) => {
      const s = r.data;
      if (!s) return;
      setLogo(s.logo_data); setLogoPosition(s.logo_position); setLogoWidth(s.logo_width);
      setWatermark(s.watermark_data); setWatermarkEnabled(s.watermark_enabled); setWatermarkOpacity(s.watermark_opacity);
    }).catch(console.error);
  }, []);

  async function save(): Promise<boolean> {
    setMessage(null); setSaving(true);
    try {
      await api.put("/api/pdf-settings", {
        logo_data: logo, logo_position: logoPosition, logo_width: logoWidth,
        watermark_data: watermark, watermark_enabled: watermarkEnabled && !!watermark, watermark_opacity: watermarkOpacity,
      });
      setMessage({ type: "ok", text: "Layout salvo" });
      return true;
    } catch (e: any) {
      setMessage({ type: "error", text: e.response?.data?.error || "Erro ao salvar" });
      return false;
    } finally { setSaving(false); }
  }

  async function preview() {
    if (!(await save())) return;
    setPreviewing(true);
    try {
      const r = await api.get("/api/pdf-settings/preview", { responseType: "blob" });
      window.open(URL.createObjectURL(new Blob([r.data], { type: "application/pdf" })), "_blank");
    } catch { setMessage({ type: "error", text: "Erro ao gerar a prévia" }); }
    finally { setPreviewing(false); }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Layout do PDF" description="Logo e marca d'água usados nos contratos em PDF" />
      <div className="flex-1 p-6">
        <Card className="max-w-2xl"><CardContent className="space-y-6 pt-6">
          <div className="space-y-4">
            <ImagePicker label="Logo (topo do contrato)" value={logo} onChange={setLogo} onError={(t) => setMessage(t ? { type: "error", text: t } : null)} />
            <div className="space-y-2">
              <Label>Posição do logo</Label>
              <div className="flex gap-2">
                {positions.map((p) => (
                  <Button key={p.value} type="button" size="sm" variant={logoPosition === p.value ? "default" : "outline"} onClick={() => setLogoPosition(p.value)}>{p.label}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Largura do logo: {logoWidth} pt</Label>
              <input type="range" min={40} max={300} step={10} value={logoWidth} onChange={(e) => setLogoWidth(Number(e.target.value))} className="w-full" />
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <ImagePicker label="Marca d'água (centro da página)" value={watermark} onChange={(v) => { setWatermark(v); if (!v) setWatermarkEnabled(false); }} onError={(t) => setMessage(t ? { type: "error", text: t } : null)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" disabled={!watermark} checked={watermarkEnabled} onChange={(e) => setWatermarkEnabled(e.target.checked)} />
              Usar marca d'água nos contratos
            </label>
            <div className="space-y-2">
              <Label>Opacidade da marca d'água: {Math.round(watermarkOpacity * 100)}%</Label>
              <input type="range" min={0.03} max={0.5} step={0.01} value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(Number(e.target.value))} className="w-full" />
            </div>
          </div>

          {message && <p className={message.type === "ok" ? "text-sm text-green-700" : "text-sm text-destructive"}>{message.text}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>Salvar</Button>
            <Button variant="outline" onClick={preview} disabled={saving || previewing}>{previewing ? "Gerando..." : "Salvar e pré-visualizar PDF"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">PNG ou JPEG de até 300 KB cada. Para a marca d'água, prefira uma imagem com fundo transparente (PNG).</p>
        </CardContent></Card>
      </div>
    </div>
  );
}
