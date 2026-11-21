"use client";

import { agoraLocal } from "../lib/parse-chamado";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function HoraField({ label, value, onChange, disabled }: Props) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="hora-row">
        <input
          type="datetime-local"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="chip"
          disabled={disabled}
          onClick={() => onChange(agoraLocal())}
        >
          Agora
        </button>
      </div>
    </label>
  );
}
