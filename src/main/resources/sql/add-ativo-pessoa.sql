-- Migration: add campo ativo para suporte a exclusao logica de tecnicos/usuarios
ALTER TABLE pessoa ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
