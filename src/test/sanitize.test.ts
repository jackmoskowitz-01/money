import { describe, it, expect } from 'vitest';
import { sanitizeHtml, stripHtml } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  it('allows safe HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeHtml(input)).toBe('<p>Hello <strong>world</strong></p>');
  });

  it('strips script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    expect(sanitizeHtml(input)).toBe('<p>Hello</p>');
  });

  it('strips event handlers', () => {
    const input = '<p onclick="alert(1)">Click me</p>';
    expect(sanitizeHtml(input)).toBe('<p>Click me</p>');
  });

  it('strips javascript: URLs', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });

  it('allows safe anchor tags with href', () => {
    const input = '<a href="https://example.com" target="_blank">Link</a>';
    expect(sanitizeHtml(input)).toContain('href="https://example.com"');
  });

  it('strips data attributes', () => {
    const input = '<div data-secret="token123">Content</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('data-secret');
  });

  it('allows table elements', () => {
    const input = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
    expect(sanitizeHtml(input)).toContain('<table>');
    expect(sanitizeHtml(input)).toContain('<td>Cell</td>');
  });

  it('strips iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
    expect(sanitizeHtml(input)).toBe('<p>Safe</p>');
  });

  it('strips img onerror', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
  });
});

describe('stripHtml', () => {
  it('removes all HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    expect(stripHtml(input)).toBe('Hello world');
  });

  it('removes script content', () => {
    const input = 'Text<script>alert(1)</script>More';
    expect(stripHtml(input)).toBe('TextMore');
  });

  it('handles plain text input', () => {
    expect(stripHtml('Just plain text')).toBe('Just plain text');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });
});
