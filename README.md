# Carbon Footprint Dashboard

A GHG (Greenhouse Gas) accounting dashboard for digital organizations, based on the methodology from the "Dwight Global Online School Carbon Footprint Assessment 2024-2025."

## Features

- **CSV Data Processing**: Upload activity data with device hours, Zoom sessions, Canvas pageviews, and tool launches
- **Monte Carlo Simulation**: 10,000 iterations (configurable) for probabilistic emissions calculations
- **Adjustable Parameters**: All emission factors and thresholds are visible and editable
- **Regional Grid Intensity**: Carbon intensity factors for US, UK, China, South Korea, UAE, and global average
- **Interactive Visualizations**: Frequency distribution histogram and category breakdown charts
- **Carbon Offset Calculator**: 70/30 credit mix cost estimation
- **Compliance Disclaimers**: NY GBL §349 and FTC Green Guides compliance text

## File Structure

```
rogue-shepard/
├── index.html          # Main dashboard UI
├── styles.css          # Premium dark theme styling
├── app.js              # Monte Carlo engine & core logic
├── charts.js           # Plotly.js visualizations
├── apps-script.js      # Google Apps Script backend
├── sample-data.csv     # Example CSV for testing
└── README.md           # This file
```

## Deployment

### GitHub Pages (Frontend)

1. Push all files to your GitHub repository
2. Go to **Settings** → **Pages**
3. Select **Deploy from a branch** → **main** → **/ (root)**
4. Your dashboard will be available at `https://[username].github.io/rogue-shepard/`

### Google Apps Script (Backend - Optional)

The frontend runs fully client-side. The Apps Script backend is optional for:
- Server-side data validation
- Report storage in Google Sheets
- Centralized parameter management

**To deploy the backend:**

1. Go to [script.google.com](https://script.google.com)
2. Create a new project
3. Copy the contents of `apps-script.js` into the editor
4. (Optional) Create a Google Sheet and update `SHEET_ID` to store reports
5. Click **Deploy** → **New Deployment**
6. Select **Web app** as the type
7. Set **Execute as**: Me
8. Set **Who has access**: Anyone
9. Click **Deploy** and copy the URL
10. (Optional) Update `CONFIG.BACKEND_URL` in `app.js` with the deployed URL

## CSV Format

Your CSV file must include these columns:

| Column | Description | Valid Values |
|--------|-------------|--------------|
| `user_type` | Type of user | Student, Staff |
| `device_hours` | Daily average device usage | 0-24 hours |
| `zoom_launches` | Total Zoom sessions in period | Integer |
| `canvas_pageviews` | Total LMS pageviews | Integer |
| `tool_launches` | Third-party tool launches | Integer |
| `region` | Geographic region | US, UK, China, South Korea, UAE, Other |

## Mathematical Models

### Distributions

| Category | Distribution | Parameters |
|----------|--------------|------------|
| Device Electricity | Log-normal | μ = ln(50W), σ = 0.2 |
| Zoom Sessions | Uniform | 0.20 - 0.80 kg CO₂/hour |
| Data Transfer | Uniform | 0.015 - 0.100 kWh/GB |
| Canvas Server | Uniform | 0.0005 - 0.002 kg CO₂/view × 1.1 |

### Grid Intensity (kg CO₂/kWh)

| Region | Intensity | Source |
|--------|-----------|--------|
| US | 0.384 | EPA eGRID 2022 |
| UK | 0.124 | UK Gov GHG Factors 2023 |
| China | 0.492 | IEA World Energy Outlook 2023 |
| South Korea | 0.415 | Korea Energy Agency 2023 |
| UAE | 0.442 | UAE Ministry of Energy 2023 |
| Other | 0.350 | IEA Global Average |

## Data Sources

- [EPA Energy Star - Device Power Consumption](https://www.energystar.gov/products/computers)
- [IEA - Data Centres and Data Transmission Networks](https://www.iea.org/reports/data-centres-and-data-transmission-networks)
- [Ember Climate - Grid Carbon Intensity](https://ember-climate.org/data/data-tools/data-explorer/)
- [Joule Journal 2021 - Network Energy Intensity](https://www.sciencedirect.com/science/article/pii/S2542435121001355)
- [Website Carbon - Web Server Emissions](https://www.websitecarbon.com/how-does-it-work/)
- [Gold Standard - Carbon Offset Pricing](https://www.goldstandard.org)

## Compliance

This tool includes required disclaimers for:

- **NY General Business Law § 349**: Consumer protection disclosure for environmental claims
- **FTC Green Guides**: Marketing claims qualification requirements

## License

MIT License - Free to use and modify

---

*Based on the Dwight Global Online School Carbon Footprint Assessment Methodology*
