"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Film, Camera, Sun, Zap, Activity, Grid3X3 } from "lucide-react";

// Import configurations from director-elements.ts
import {
  SHOT_TYPES,
  FOCAL_LENGTHS,
  CAMERA_HEIGHTS,
  DEPTHS_OF_FIELD,
  COMPOSITIONS,
  CAMERA_MOVEMENTS,
  ACTION_RHYTHMS,
  DIRECTOR_STYLES,
  LIGHTING_SETUPS,
  MATERIAL_KEYWORDS,
  type FrameState,
} from "./director-elements";

interface DirectorElementsPanelProps {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-zinc-800/60 rounded-lg overflow-hidden bg-zinc-950/30">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 text-violet-400" />
          <span className="text-xs font-medium text-zinc-200">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="size-3.5 text-zinc-500" />
        ) : (
          <ChevronRight className="size-3.5 text-zinc-500" />
        )}
      </button>
      {isOpen && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
}

function FrameField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-zinc-500 w-14 shrink-0">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded border border-zinc-800/60 bg-zinc-900/40 px-2 py-1 text-[10px] text-zinc-300 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string; description?: string; effect?: string }[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((o) => o.value === value);

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-zinc-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-800/60 bg-zinc-950/60 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-violet-500/40 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {selected && (selected.description || selected.effect) && (
        <p className="text-[10px] text-zinc-500">
          {selected.description || selected.effect}
        </p>
      )}
    </div>
  );
}

export default function DirectorElementsPanel({ data, onChange }: DirectorElementsPanelProps) {
  const cinematography = (data.cinematography as Record<string, unknown>) || {};
  const firstFrame = (data.firstFrame as FrameState) || {};
  const lastFrame = (data.lastFrame as FrameState) || {};

  const updateCinematography = (key: string, value: unknown) => {
    onChange("cinematography", { ...cinematography, [key]: value });
  };

  // 九宫格构图选择器
  const compositionGrid = (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Grid3X3 className="size-3.5 text-violet-400" />
        <span className="text-[11px] font-medium text-zinc-300">九宫格构图</span>
      </div>
      <div className="grid grid-cols-3 gap-1 aspect-square max-w-[120px] mx-auto">
        {[...Array(9)].map((_, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          const isIntersection = (row === 1 && col === 1) || (row === 1 && col === 2) || (row === 2 && col === 1) || (row === 2 && col === 2);
          const isSelected = isIntersection && cinematography.composition === "rule_of_thirds";
          const isCenter = row === 1 && col === 1 && cinematography.composition === "center";
          const isSymmetry = (row === 0 || row === 2) && col === 1 && cinematography.composition === "symmetry";

          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (isIntersection) updateCinematography("composition", "rule_of_thirds");
                else if (row === 1 && col === 1) updateCinematography("composition", "center");
                else if (col === 1) updateCinematography("composition", "symmetry");
                else updateCinematography("composition", "leading_lines");
              }}
              className={`
                aspect-square rounded border transition-all duration-200
                ${isSelected || isCenter || isSymmetry
                  ? "bg-violet-500/40 border-violet-400"
                  : "bg-zinc-800/60 border-zinc-700/50 hover:bg-zinc-700/50"
                }
              `}
            />
          );
        })}
      </div>
      <p className="text-[10px] text-zinc-500 text-center">
        {COMPOSITIONS.find(c => c.value === cinematography.composition)?.description}
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* 摄影语言 - 10元素 */}
      <Section title="摄影语言 (10元素)" icon={Camera} defaultOpen={true}>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="景别 (Shot Type)"
            value={(cinematography.shotType as string) || "MS"}
            options={SHOT_TYPES}
            onChange={(v) => updateCinematography("shotType", v)}
          />
          <SelectField
            label="焦段 (Focal Length)"
            value={String(cinematography.focalLength || 35)}
            options={FOCAL_LENGTHS.map((f) => ({ ...f, value: String(f.value) }))}
            onChange={(v) => updateCinematography("focalLength", parseInt(v))}
          />
          <SelectField
            label="机高 (Camera Height)"
            value={(cinematography.cameraHeight as string) || "eye"}
            options={CAMERA_HEIGHTS}
            onChange={(v) => updateCinematography("cameraHeight", v)}
          />
          <SelectField
            label="景深 (Depth of Field)"
            value={(cinematography.depthOfField as string) || "medium"}
            options={DEPTHS_OF_FIELD}
            onChange={(v) => updateCinematography("depthOfField", v)}
          />
        </div>
        {compositionGrid}
        <SelectField
          label="运镜 (Camera Movement)"
          value={(cinematography.cameraMovement as string) || "static"}
          options={CAMERA_MOVEMENTS}
          onChange={(v) => updateCinematography("cameraMovement", v)}
        />
        <SelectField
          label="动作节奏 (Action Rhythm)"
          value={(cinematography.actionRhythm as string) || "medium"}
          options={ACTION_RHYTHMS}
          onChange={(v) => updateCinematography("actionRhythm", v)}
        />
      </Section>

      {/* 导演风格 */}
      <Section title="导演风格参考" icon={Film}>
        <SelectField
          label="参考导演"
          value={(cinematography.directorStyle as string) || ""}
          options={[
            { value: "", label: "无特定风格", description: "不参考特定导演" },
            ...DIRECTOR_STYLES.map((d) => ({
              value: d.id,
              label: `${d.name} (${d.nationality})`,
              description: d.signature,
            })),
          ]}
          onChange={(v) => updateCinematography("directorStyle", v)}
        />
      </Section>

      {/* 光影设置 */}
      <Section title="光影设置" icon={Sun}>
        <SelectField
          label="主光源 (Key Light)"
          value={((cinematography.lighting as Record<string, string>)?.keyLight) || "top"}
          options={LIGHTING_SETUPS.keyLight}
          onChange={(v) =>
            updateCinematography("lighting", {
              ...((cinematography.lighting as Record<string, string>) || {}),
              keyLight: v,
            })
          }
        />
        <SelectField
          label="色温 (Color Temperature)"
          value={((cinematography.lighting as Record<string, string>)?.colorTemperature) || "neutral"}
          options={LIGHTING_SETUPS.colorTemperature}
          onChange={(v) =>
            updateCinematography("lighting", {
              ...((cinematography.lighting as Record<string, string>) || {}),
              colorTemperature: v,
            })
          }
        />
        <SelectField
          label="氛围 (Mood)"
          value={((cinematography.lighting as Record<string, string>)?.mood) || "neutral"}
          options={LIGHTING_SETUPS.mood}
          onChange={(v) =>
            updateCinematography("lighting", {
              ...((cinematography.lighting as Record<string, string>) || {}),
              mood: v,
            })
          }
        />
      </Section>

      {/* 材质关键词 */}
      <Section title="材质关键词" icon={Zap}>
        <div className="grid grid-cols-2 gap-2">
          {MATERIAL_KEYWORDS.map((category) => (
            <div key={category.category} className="space-y-1">
              <span className="text-[10px] font-medium text-zinc-500">{category.category}</span>
              <div className="flex flex-wrap gap-1">
                {category.keywords.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => {
                      const current = (cinematography.materialKeywords as string[]) || [];
                      const updated = current.includes(kw)
                        ? current.filter((k) => k !== kw)
                        : [...current, kw];
                      updateCinematography("materialKeywords", updated);
                    }}
                    className={`px-1.5 py-0.5 text-[9px] rounded border transition-colors ${
                      ((cinematography.materialKeywords as string[]) || []).includes(kw)
                        ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                        : "bg-zinc-900/60 border-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 首尾帧状态 - 表单化 */}
      <Section title="首尾帧状态" icon={Activity}>
        <div className="space-y-4">
          {/* 首帧 */}
          <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-medium text-emerald-400">首帧 (First Frame)</span>
            </div>
            <div className="space-y-2">
              <FrameField
                label="角色位置"
                value={firstFrame.characterPosition || ""}
                onChange={(v) => onChange("firstFrame", { ...firstFrame, characterPosition: v })}
                placeholder="画面中央/左侧/右侧..."
              />
              <FrameField
                label="角色姿势"
                value={firstFrame.characterPosture || ""}
                onChange={(v) => onChange("firstFrame", { ...firstFrame, characterPosture: v })}
                placeholder="站立/行走/奔跑..."
              />
              <FrameField
                label="角色朝向"
                value={firstFrame.characterOrientation || ""}
                onChange={(v) => onChange("firstFrame", { ...firstFrame, characterOrientation: v })}
                placeholder="面向前方/侧面/背面..."
              />
              <FrameField
                label="角色表情"
                value={firstFrame.characterExpression || ""}
                onChange={(v) => onChange("firstFrame", { ...firstFrame, characterExpression: v })}
                placeholder="微笑/严肃/惊讶..."
              />
              <FrameField
                label="环境状态"
                value={firstFrame.environmentState || ""}
                onChange={(v) => onChange("firstFrame", { ...firstFrame, environmentState: v })}
                placeholder="白天/夜晚/室内..."
              />
              <FrameField
                label="光影状态"
                value={firstFrame.lightingState || ""}
                onChange={(v) => onChange("firstFrame", { ...firstFrame, lightingState: v })}
                placeholder="自然光/侧光/逆光..."
              />
            </div>
          </div>

          {/* 尾帧 */}
          <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-950/10 p-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-400" />
              <span className="text-[11px] font-medium text-amber-400">尾帧 (Last Frame)</span>
            </div>
            <div className="space-y-2">
              <FrameField
                label="角色位置"
                value={lastFrame.characterPosition || ""}
                onChange={(v) => onChange("lastFrame", { ...lastFrame, characterPosition: v })}
                placeholder="画面中央/左侧/右侧..."
              />
              <FrameField
                label="角色姿势"
                value={lastFrame.characterPosture || ""}
                onChange={(v) => onChange("lastFrame", { ...lastFrame, characterPosture: v })}
                placeholder="站立/行走/奔跑..."
              />
              <FrameField
                label="角色朝向"
                value={lastFrame.characterOrientation || ""}
                onChange={(v) => onChange("lastFrame", { ...lastFrame, characterOrientation: v })}
                placeholder="面向前方/侧面/背面..."
              />
              <FrameField
                label="角色表情"
                value={lastFrame.characterExpression || ""}
                onChange={(v) => onChange("lastFrame", { ...lastFrame, characterExpression: v })}
                placeholder="微笑/严肃/惊讶..."
              />
              <FrameField
                label="环境状态"
                value={lastFrame.environmentState || ""}
                onChange={(v) => onChange("lastFrame", { ...lastFrame, environmentState: v })}
                placeholder="白天/夜晚/室内..."
              />
              <FrameField
                label="光影状态"
                value={lastFrame.lightingState || ""}
                onChange={(v) => onChange("lastFrame", { ...lastFrame, lightingState: v })}
                placeholder="自然光/侧光/逆光..."
              />
            </div>
          </div>

          {/* 对比预览 */}
          {(firstFrame.characterPosition || lastFrame.characterPosition) && (
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/30 p-3">
              <div className="text-[10px] font-medium text-zinc-500 mb-2">状态对比</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="text-emerald-400">
                  {firstFrame.characterPosition && `位置: ${firstFrame.characterPosition}`}
                </div>
                <div className="text-amber-400">
                  {lastFrame.characterPosition && `位置: ${lastFrame.characterPosition}`}
                </div>
                <div className="text-emerald-400">
                  {firstFrame.characterPosture && `姿势: ${firstFrame.characterPosture}`}
                </div>
                <div className="text-amber-400">
                  {lastFrame.characterPosture && `姿势: ${lastFrame.characterPosture}`}
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
