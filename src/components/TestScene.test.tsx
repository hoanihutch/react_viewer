// src/components/TestScene.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TestScene from './TestScene'

describe('TestScene', () => {
  it('renders without crashing', () => {
    render(<TestScene />)
    expect(screen.getByText(/Status:/)).toBeInTheDocument()
  })
})