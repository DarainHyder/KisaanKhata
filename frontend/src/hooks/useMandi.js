import { useEffect, useState } from 'react'
import api from '../api'

// Crops shown on the landing page, in display order. Names match the AMIS scraper.
export const BOARD_CROPS = ['wheat', 'maize', 'cotton', 'potato', 'onion', 'tomato', 'garlic', 'sugar', 'mango']

// One shared request per crop for the whole page (ticker, checker and nav badge).
const cache = new Map()

function fetchCrop(crop) {
  if (!cache.has(crop)) {
    cache.set(crop, api.get(`/prices/compare-cities/${crop}`, { timeout: 25000 })
      .then(r => {
        const cities = (r.data.cities || []).filter(c => c.fqp > 0)
        if (!cities.length) return null
        const avg = cities.reduce((s, c) => s + c.fqp, 0) / cities.length
        return { crop, avg, cities, ageHours: r.data.data_age_hours, scrapedAt: r.data.scraped_at }
      })
      .catch(() => null))
  }
  return cache.get(crop)
}

/** Live AMIS board: { status: 'loading' | 'live' | 'offline', crops: { [name]: {...} } } */
export function useMandiBoard(crops = BOARD_CROPS) {
  const [state, setState] = useState({ status: 'loading', crops: {} })
  const key = crops.join(',')

  useEffect(() => {
    let alive = true
    Promise.all(key.split(',').map(fetchCrop)).then(results => {
      if (!alive) return
      const found = Object.fromEntries(results.filter(Boolean).map(r => [r.crop, r]))
      setState({ status: Object.keys(found).length ? 'live' : 'offline', crops: found })
    })
    return () => { alive = false }
  }, [key])

  return state
}

// AMIS city names arrive as typed by each market committee ("DGKHAN", "TTSingh", "kotmoman").
const CITY_FIX = {
  dgkhan: 'D.G. Khan', ttsingh: 'T.T. Singh', kotmoman: 'Kot Momin', sraialamgir: 'Sarai Alamgir',
  taunsasharif: 'Taunsa Sharif', rahimyarkhan: 'Rahim Yar Khan', bahawalpur: 'Bahawalpur', jampur: 'Jampur',
  mandibahauddin: 'Mandi Bahauddin',
}
export function cityName(raw = '') {
  const key = raw.toLowerCase().replace(/[^a-z]/g, '')
  if (CITY_FIX[key]) return CITY_FIX[key]
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export const fmtPKR = n => Math.round(n).toLocaleString('en-US')
