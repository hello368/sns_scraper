"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Search, BarChart3, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { RegionSelect } from "@/components/ui/region-select"

interface Props {
  onSearchStart: (taskId: string) => void
}

const DEFAULT_EXPANSIONS = ["", " before after", " treatment", " clinic"]

export default function FacebookAdsTab({ onSearchStart }: Props) {
  const [query, setQuery] = useState("")
  const [country, setCountry] = useState("KR")
  const [activeStatus, setActiveStatus] = useState("all")
  const [useAiAnalysis, setUseAiAnalysis] = useState(false)
  const [maxAds, setMaxAds] = useState(20)
  const [region, setRegion] = useState("US")
  const [customExpansions, setCustomExpansions] = useState<string[]>([])
  const [newExpansion, setNewExpansion] = useState("")
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) { toast.error("Enter a brand name or keyword"); return }
    setSearching(true)

    // Run main query
    try {
      const res = await api.searchFacebookAds({
        query: query.trim(),
        country,
        active_status: activeStatus,
        use_ai_analysis: useAiAnalysis,
        max_ads: maxAds,
        region: region,
      })
      onSearchStart(res.task_id)

      // Run expansions sequentially
      const allExpansions = [
        ...DEFAULT_EXPANSIONS.map(s => s ? `${query.trim()}${s}` : "").filter(Boolean),
        ...customExpansions.filter(Boolean),
      ]

      let lastTaskId = res.task_id
      for (const exp of allExpansions) {
        if (!exp.trim()) continue
        // Small delay to let progress system handle multiple tasks
        await new Promise(r => setTimeout(r, 500))
        const expRes = await api.searchFacebookAds({
          query: exp.trim(),
          country,
          active_status: activeStatus,
          use_ai_analysis: false,
          max_ads: Math.min(maxAds, 20), // fewer per expansion
          region: region,
        })
        lastTaskId = expRes.task_id
      }

      toast.success(`Ads search started! ${allExpansions.length + 1} queries running`)
    } catch (e: any) {
      toast.error("Search failed: " + e.message)
    } finally {
      setSearching(false)
    }
  }

  const addCustomExpansion = () => {
    if (newExpansion.trim()) {
      setCustomExpansions(prev => [...prev, newExpansion.trim()])
      setNewExpansion("")
    }
  }

  const removeExpansion = (idx: number) => {
    setCustomExpansions(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-emerald-600">
        <BarChart3 className="h-5 w-5" />
        <span className="text-sm font-medium">Meta Ad Library — Competitive Intelligence</span>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          💰 <strong>Cost: $0.15/ad.</strong> Start with maxAds=20 for testing.
          The scraper automatically expands to related keywords for maximum coverage.
        </p>
      </div>

      <Input
        placeholder="Brand name or keyword (e.g. Nike, Coca-Cola)"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Country</label>
          <select
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={country}
            onChange={e => setCountry(e.target.value)}
          >
            <option value="KR">🇰🇷 South Korea</option>
            <option value="US">🇺🇸 USA</option>
            <option value="JP">🇯🇵 Japan</option>
            <option value="GB">🇬🇧 UK</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Ad Status</label>
          <select
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={activeStatus}
            onChange={e => setActiveStatus(e.target.value)}
          >
            <option value="all">All (Active + Inactive)</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Max Ads</label>
          <Input type="number" min={1} max={500} value={maxAds} onChange={e => setMaxAds(Number(e.target.value))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <RegionSelect value={region} onChange={setRegion} />
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={useAiAnalysis}
              onChange={e => setUseAiAnalysis(e.target.checked)}
              className="rounded"
            />
            Gemini AI Analysis
          </label>
        </div>
      </div>

      {/* Auto expansion keywords */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">
          🔄 Auto-expanded keywords (searched separately)
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {DEFAULT_EXPANSIONS.map((suffix, i) => (
            <span key={i} className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-xs font-medium">
              {query ? `"${query.trim()}${suffix}"` : `"keyword${suffix}"`}
            </span>
          ))}
          {customExpansions.map((exp, i) => (
            <span key={`c-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-xs font-medium">
              `{exp}`
              <button onClick={() => removeExpansion(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add custom expansion..."
            value={newExpansion}
            onChange={e => setNewExpansion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustomExpansion()}
            className="text-sm"
          />
          <Button variant="outline" size="icon" onClick={addCustomExpansion}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Button onClick={handleSearch} disabled={searching || !query.trim()} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {searching ? "Searching Ads Library..." : "Search Ads Library"}
      </Button>
    </div>
  )
}
