'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Wind,
  Waves,
  Gauge,
  Thermometer,
  Moon,
  Fish,
  ChevronDown,
  Save,
  X,
  Loader2,
} from 'lucide-react'
import type { AlertProfile, AlertTriggers } from '@/lib/custom-alert-engine'
import { AlertLocationMap } from './alert-location-map'

interface CustomAlertFormProps {
  profile?: AlertProfile | null
  onSubmit: (data: Partial<AlertProfile> & { id?: string }) => Promise<void>
  onCancel: () => void
}

const SPECIES_OPTIONS = [
  { id: 'chinook-salmon', name: 'Chinook Salmon' },
  { id: 'coho-salmon', name: 'Coho Salmon' },
  { id: 'pink-salmon', name: 'Pink Salmon' },
  { id: 'sockeye-salmon', name: 'Sockeye Salmon' },
  { id: 'chum-salmon', name: 'Chum Salmon' },
  { id: 'halibut', name: 'Halibut' },
  { id: 'lingcod', name: 'Lingcod' },
  { id: 'rockfish', name: 'Rockfish' },
]

const TIDE_PHASES = [
  { id: 'incoming', name: 'Incoming (Rising)' },
  { id: 'outgoing', name: 'Outgoing (Falling)' },
  { id: 'high_slack', name: 'High Slack' },
  { id: 'low_slack', name: 'Low Slack' },
]

const WIND_DIRECTIONS = [
  { value: 0, label: 'N' },
  { value: 45, label: 'NE' },
  { value: 90, label: 'E' },
  { value: 135, label: 'SE' },
  { value: 180, label: 'S' },
  { value: 225, label: 'SW' },
  { value: 270, label: 'W' },
  { value: 315, label: 'NW' },
]

const DEFAULT_TRIGGERS: AlertTriggers = {
  wind: { enabled: false, speed_min: 0, speed_max: 15 },
  tide: { enabled: false, phases: ['incoming'] },
  pressure: { enabled: false, trend: 'falling', gradient_threshold: -2.0 },
  water_temp: { enabled: false, min: 10, max: 14 },
  solunar: { enabled: false, phases: ['major'] },
  fishing_score: { enabled: false, min_score: 70 },
}

export function CustomAlertForm({ profile, onSubmit, onCancel }: CustomAlertFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState(profile?.name || '')
  const [locationLat, setLocationLat] = useState(profile?.location_lat || 48.4284)
  const [locationLng, setLocationLng] = useState(profile?.location_lng || -123.3656)
  const [locationName, setLocationName] = useState(profile?.location_name || 'Victoria, BC')
  const [triggers, setTriggers] = useState<AlertTriggers>(profile?.triggers || DEFAULT_TRIGGERS)
  const [logicMode, setLogicMode] = useState<'AND' | 'OR'>(profile?.logic_mode || 'AND')
  const [cooldownHours, setCooldownHours] = useState(profile?.cooldown_hours || 12)
  const [activeHoursEnabled, setActiveHoursEnabled] = useState(!!profile?.active_hours)
  const [activeHoursStart, setActiveHoursStart] = useState(profile?.active_hours?.start || '05:00')
  const [activeHoursEnd, setActiveHoursEnd] = useState(profile?.active_hours?.end || '21:00')

  // Collapsible states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    wind: triggers.wind?.enabled || false,
    tide: triggers.tide?.enabled || false,
    pressure: triggers.pressure?.enabled || false,
    water_temp: triggers.water_temp?.enabled || false,
    solunar: triggers.solunar?.enabled || false,
    fishing_score: triggers.fishing_score?.enabled || false,
  })

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const updateTrigger = <K extends keyof AlertTriggers>(
    key: K,
    updates: Partial<NonNullable<AlertTriggers[K]>>
  ) => {
    setTriggers((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const data: Partial<AlertProfile> & { id?: string } = {
        name,
        location_lat: locationLat,
        location_lng: locationLng,
        location_name: locationName,
        triggers,
        logic_mode: logicMode,
        cooldown_hours: cooldownHours,
        active_hours: activeHoursEnabled
          ? { start: activeHoursStart, end: activeHoursEnd }
          : undefined,
      }

      if (profile) {
        data.id = profile.id
      }

      await onSubmit(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-rc-rule shadow-none">
      <CardHeader>
        <CardTitle className="text-rc-ink">{profile ? 'Edit Alert' : 'Create New Alert'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error */}
          {error && (
            <div className="p-3 rounded-md bg-rc-poor-bg border border-rc-poor/40 text-rc-poor-ink text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-rc-ink">Alert Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sooke Basin Chinook"
                required
              />
            </div>

            {/* Pin drop map selector */}
            <div>
              <Label className="text-rc-ink mb-2 block">Drop Pin on Map</Label>
              <AlertLocationMap
                latitude={locationLat}
                longitude={locationLng}
                onLocationChange={(lat, lng) => {
                  setLocationLat(lat)
                  setLocationLng(lng)
                }}
              />
            </div>

            <div>
              <Label htmlFor="locationName" className="text-rc-ink">Location Name</Label>
              <Input
                id="locationName"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g., Victoria, BC"
              />
            </div>
          </div>

          {/* Triggers */}
          <div className="space-y-3">
            <Label className="text-base font-semibold text-rc-ink">Trigger Conditions</Label>

            {/* Wind Trigger */}
            <Collapsible open={openSections.wind} onOpenChange={() => toggleSection('wind')}>
              <div className="border border-rc-rule rounded-lg bg-rc-surface">
                <div className="flex items-center justify-between w-full p-3 hover:bg-rc-rule-soft">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={triggers.wind?.enabled}
                      onCheckedChange={(checked) => {
                        updateTrigger('wind', { enabled: checked })
                        if (checked) setOpenSections((prev) => ({ ...prev, wind: true }))
                      }}
                    />
                    <Wind className="h-4 w-4 text-rc-ink-mute" />
                    <span className="font-medium text-rc-ink">Wind</span>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.wind ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="p-3 pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-rc-ink-mute">Min Speed (mph)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={triggers.wind?.speed_min || 0}
                        onChange={(e) => updateTrigger('wind', { speed_min: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-rc-ink-mute">Max Speed (mph)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={triggers.wind?.speed_max || 15}
                        onChange={(e) => updateTrigger('wind', { speed_max: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-rc-ink-mute">Direction (optional)</Label>
                      <Select
                        value={triggers.wind?.direction_center?.toString() || '__none__'}
                        onValueChange={(v) => updateTrigger('wind', { direction_center: v === '__none__' ? undefined : parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any direction" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Any direction</SelectItem>
                          {WIND_DIRECTIONS.map((d) => (
                            <SelectItem key={d.value} value={d.value.toString()}>
                              {d.label} ({d.value}°)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-rc-ink-mute">Tolerance (±degrees)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={180}
                        value={triggers.wind?.direction_tolerance || 45}
                        onChange={(e) => updateTrigger('wind', { direction_tolerance: parseInt(e.target.value) })}
                        disabled={!triggers.wind?.direction_center}
                        className="disabled:opacity-50"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Tide Trigger */}
            <Collapsible open={openSections.tide} onOpenChange={() => toggleSection('tide')}>
              <div className="border border-rc-rule rounded-lg bg-rc-surface">
                <div className="flex items-center justify-between w-full p-3 hover:bg-rc-rule-soft">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={triggers.tide?.enabled}
                      onCheckedChange={(checked) => {
                        updateTrigger('tide', { enabled: checked })
                        if (checked) setOpenSections((prev) => ({ ...prev, tide: true }))
                      }}
                    />
                    <Waves className="h-4 w-4 text-rc-ink-mute" />
                    <span className="font-medium text-rc-ink">Tide Phase</span>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rc-ink-mute hover:text-rc-ink">
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.tide ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="p-3 pt-0 space-y-3">
                  <div className="space-y-2">
                    {TIDE_PHASES.map((phase) => (
                      <div key={phase.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`tide-${phase.id}`}
                          checked={triggers.tide?.phases?.includes(phase.id as any)}
                          onCheckedChange={(checked) => {
                            const current = triggers.tide?.phases || []
                            const updated = checked
                              ? [...current, phase.id]
                              : current.filter((p) => p !== phase.id)
                            updateTrigger('tide', { phases: updated as any })
                          }}
                        />
                        <Label htmlFor={`tide-${phase.id}`} className="text-sm text-rc-ink-mute">
                          {phase.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label className="text-xs text-rc-ink-mute">Min Tidal Exchange (m, optional)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      value={triggers.tide?.exchange_min || ''}
                      onChange={(e) => updateTrigger('tide', { exchange_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Any exchange"
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Pressure Trigger */}
            <Collapsible open={openSections.pressure} onOpenChange={() => toggleSection('pressure')}>
              <div className="border border-rc-rule rounded-lg bg-rc-surface">
                <div className="flex items-center justify-between w-full p-3 hover:bg-rc-rule-soft">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={triggers.pressure?.enabled}
                      onCheckedChange={(checked) => {
                        updateTrigger('pressure', { enabled: checked })
                        if (checked) setOpenSections((prev) => ({ ...prev, pressure: true }))
                      }}
                    />
                    <Gauge className="h-4 w-4 text-rc-ink-mute" />
                    <span className="font-medium text-rc-ink">Barometric Pressure</span>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.pressure ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="p-3 pt-0 space-y-3">
                  <div>
                    <Label className="text-xs text-rc-ink-mute">Trend</Label>
                    <Select
                      value={triggers.pressure?.trend || 'falling'}
                      onValueChange={(v) => updateTrigger('pressure', { trend: v as 'rising' | 'falling' | 'steady' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="falling">Falling</SelectItem>
                        <SelectItem value="rising">Rising</SelectItem>
                        <SelectItem value="steady">Steady</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-rc-ink-mute">Gradient Threshold (mb/3h)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={triggers.pressure?.gradient_threshold || -2}
                      onChange={(e) => updateTrigger('pressure', { gradient_threshold: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-rc-ink-mute mt-1">
                      {triggers.pressure?.trend === 'falling' ? 'Alert when change ≤ threshold' : 'Alert when change ≥ threshold'}
                    </p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Water Temp Trigger */}
            <Collapsible open={openSections.water_temp} onOpenChange={() => toggleSection('water_temp')}>
              <div className="border border-rc-rule rounded-lg bg-rc-surface">
                <div className="flex items-center justify-between w-full p-3 hover:bg-rc-rule-soft">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={triggers.water_temp?.enabled}
                      onCheckedChange={(checked) => {
                        updateTrigger('water_temp', { enabled: checked })
                        if (checked) setOpenSections((prev) => ({ ...prev, water_temp: true }))
                      }}
                    />
                    <Thermometer className="h-4 w-4 text-rc-ink-mute" />
                    <span className="font-medium text-rc-ink">Water Temperature</span>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.water_temp ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="p-3 pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-rc-ink-mute">Min (°C)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={triggers.water_temp?.min || 10}
                        onChange={(e) => updateTrigger('water_temp', { min: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-rc-ink-mute">Max (°C)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={triggers.water_temp?.max || 14}
                        onChange={(e) => updateTrigger('water_temp', { max: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Solunar Trigger */}
            <Collapsible open={openSections.solunar} onOpenChange={() => toggleSection('solunar')}>
              <div className="border border-rc-rule rounded-lg bg-rc-surface">
                <div className="flex items-center justify-between w-full p-3 hover:bg-rc-rule-soft">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={triggers.solunar?.enabled}
                      onCheckedChange={(checked) => {
                        updateTrigger('solunar', { enabled: checked })
                        if (checked) setOpenSections((prev) => ({ ...prev, solunar: true }))
                      }}
                    />
                    <Moon className="h-4 w-4 text-rc-ink-mute" />
                    <span className="font-medium text-rc-ink">Solunar Period</span>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.solunar ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="p-3 pt-0 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="solunar-major"
                        checked={triggers.solunar?.phases?.includes('major')}
                        onCheckedChange={(checked) => {
                          const current = triggers.solunar?.phases || []
                          const updated = checked
                            ? [...current, 'major']
                            : current.filter((p) => p !== 'major')
                          updateTrigger('solunar', { phases: updated as any })
                        }}
                      />
                      <Label htmlFor="solunar-major" className="text-sm">
                        Major Period (~2 hrs, highest activity)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="solunar-minor"
                        checked={triggers.solunar?.phases?.includes('minor')}
                        onCheckedChange={(checked) => {
                          const current = triggers.solunar?.phases || []
                          const updated = checked
                            ? [...current, 'minor']
                            : current.filter((p) => p !== 'minor')
                          updateTrigger('solunar', { phases: updated as any })
                        }}
                      />
                      <Label htmlFor="solunar-minor" className="text-sm">
                        Minor Period (~1 hr, moderate activity)
                      </Label>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Fishing Score Trigger */}
            <Collapsible open={openSections.fishing_score} onOpenChange={() => toggleSection('fishing_score')}>
              <div className="border border-rc-rule rounded-lg bg-rc-surface">
                <div className="flex items-center justify-between w-full p-3 hover:bg-rc-rule-soft">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={triggers.fishing_score?.enabled}
                      onCheckedChange={(checked) => {
                        updateTrigger('fishing_score', { enabled: checked })
                        if (checked) setOpenSections((prev) => ({ ...prev, fishing_score: true }))
                      }}
                    />
                    <Fish className="h-4 w-4 text-rc-ink-mute" />
                    <span className="font-medium text-rc-ink">Fishing Score</span>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.fishing_score ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="p-3 pt-0 space-y-3">
                  <div>
                    <Label className="text-xs text-rc-ink-mute">Minimum Score: {triggers.fishing_score?.min_score || 70}/100</Label>
                    <Slider
                      value={[triggers.fishing_score?.min_score || 70]}
                      onValueChange={([v]) => updateTrigger('fishing_score', { min_score: v })}
                      min={0}
                      max={100}
                      step={5}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-rc-ink-mute">Species (optional)</Label>
                    <Select
                      value={triggers.fishing_score?.species || '__none__'}
                      onValueChange={(v) => updateTrigger('fishing_score', { species: v === '__none__' ? undefined : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any species" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Any species</SelectItem>
                        {SPECIES_OPTIONS.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>

          {/* Logic Mode */}
          <div className="space-y-3">
            <Label className="text-base font-semibold text-rc-ink">Logic Mode</Label>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="logic-and"
                  name="logic"
                  value="AND"
                  checked={logicMode === 'AND'}
                  onChange={() => setLogicMode('AND')}
                  className="w-4 h-4 accent-rc-brand"
                />
                <Label htmlFor="logic-and" className="text-sm font-normal text-rc-ink-mute">
                  AND - All conditions must match
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="logic-or"
                  name="logic"
                  value="OR"
                  checked={logicMode === 'OR'}
                  onChange={() => setLogicMode('OR')}
                  className="w-4 h-4 accent-rc-brand"
                />
                <Label htmlFor="logic-or" className="text-sm font-normal text-rc-ink-mute">
                  OR - Any condition can match
                </Label>
              </div>
            </div>
          </div>

          {/* Cooldown */}
          <div className="space-y-3">
            <Label className="text-base font-semibold text-rc-ink">Cooldown Period</Label>
            <div>
              <Label className="text-xs text-rc-ink-mute">
                Minimum {cooldownHours} hours between notifications
              </Label>
              <Slider
                value={[cooldownHours]}
                onValueChange={([v]) => setCooldownHours(v)}
                min={1}
                max={168}
                step={1}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-rc-ink-mute mt-1">
                <span>1 hour</span>
                <span>1 week</span>
              </div>
            </div>
          </div>

          {/* Active Hours */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold text-rc-ink">Active Hours</Label>
              <Switch
                checked={activeHoursEnabled}
                onCheckedChange={setActiveHoursEnabled}
              />
            </div>
            {activeHoursEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-rc-ink-mute">Start Time</Label>
                  <Input
                    type="time"
                    value={activeHoursStart}
                    onChange={(e) => setActiveHoursStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-rc-ink-mute">End Time</Label>
                  <Input
                    type="time"
                    value={activeHoursEnd}
                    onChange={(e) => setActiveHoursEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-rc-rule">
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="border-rc-rule text-rc-ink-mute hover:bg-rc-surface">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-rc-brand hover:bg-rc-brand-hover text-white">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {profile ? 'Update Alert' : 'Create Alert'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
