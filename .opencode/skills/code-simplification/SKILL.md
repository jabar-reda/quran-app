---
name: code-simplification
description: Simplifies code for clarity. Use when refactoring code for clarity without changing behavior. Use when code works but is harder to read, maintain, or extend than it should be. Use when reviewing code that has accumulated unnecessary complexity.
---

# Code Simplification

> Inspired by the [Claude Code Simplifier plugin](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md). Adapted here as a model-agnostic, process-driven skill for any AI coding agent.

## Overview

Simplify code by reducing complexity while preserving exact behavior. The goal is not fewer lines — it's code that is easier to read, understand, modify, and debug. Every simplification must pass a simple test: "Would a new team member understand this faster than the original?"

## The Five Principles

### 1. Preserve Behavior Exactly

Don't change what the code does — only how it expresses it. All inputs, outputs, side effects, error behavior, and edge cases must remain identical.

### 2. Follow Project Conventions

Match the project's style for function declarations, naming, and error handling.

### 3. Prefer Clarity Over Cleverness

Explicit code is better than compact code when the compact version requires a mental pause to parse. No nested ternaries; use if/else or lookup objects.

### 4. Maintain Balance

Don't inline helpers that give a concept a name. Don't merge unrelated logic. Fewer lines is not the goal; easier comprehension is.

### 5. Scope to What Changed

Default to simplifying recently modified code. Avoid drive-by refactors of unrelated code.

## Process

1. Understand before touching (Chesterton's Fence).
2. Identify opportunities: deep nesting 3+, long functions 50+, nested ternaries, boolean flags, duplicated 5+ lines, dead code, generic names.
3. Apply incrementally, one change at a time, verify after each.
4. Verify: tests pass unmodified, no error handling removed, diff clean.

## JavaScript Guidance

- Remove unnecessary async wrappers.
- Use `||` / `??` for fallback assignment.
- Use `.filter()` instead of manual array building with push.
- Return boolean expressions directly instead of if/return true/false.
- Use guard clauses and early returns to flatten nesting.

## Verification

- [ ] Behavior identical, tests pass unmodified
- [ ] No error handling removed
- [ ] No dead code left behind
- [ ] Diff clean and reviewable
