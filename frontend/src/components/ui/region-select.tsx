"use client"

interface Props {
  value: string
  onChange: (v: string) => void
}

const REGIONS = [
  { value: "US", label: "🇺🇸 US / English" },
  { value: "KR", label: "🇰🇷 Korea / 한국어" },
  { value: "JP", label: "🇯🇵 Japan / 日本語" },
  { value: "EU", label: "🇪🇺 Europe" },
]

export function RegionSelect({ value, onChange }: Props) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">Region</label>
      <select
        className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {REGIONS.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
    </div>
  )
}
