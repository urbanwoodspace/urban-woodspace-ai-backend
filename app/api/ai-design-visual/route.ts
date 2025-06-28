import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// CORS configuration for your Namecheap domain
const ALLOWED_ORIGINS = [
  "https://urbanwoodspace.com",
  "https://www.urbanwoodspace.com",
  "http://localhost:3000", // For development
]

function corsHeaders(origin: string | null) {
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin)
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(origin),
  })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  const headers = corsHeaders(origin)

  try {
    // Rate limiting check
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers },
      )
    }

    const formData = await request.formData()
    const image = formData.get("image") as File
    const action = formData.get("action") as string

    if (!image) {
      return NextResponse.json({ success: false, error: "No image provided" }, { status: 400, headers })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "AI service temporarily unavailable" },
        { status: 500, headers },
      )
    }

    // Validate image
    if (image.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Image too large. Please use an image under 20MB." },
        { status: 400, headers },
      )
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Please upload a valid image file." }, { status: 400, headers })
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString("base64")
    const imageUrl = `data:${image.type};base64,${base64Image}`

    if (action === "analyze") {
      console.log("🔍 Analyzing kitchen space with GPT-4 Vision...")

      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `As a professional kitchen designer for Urban Woodspace in Calgary, analyze this kitchen space in detail. Provide:

1. LAYOUT ANALYSIS:
   - Layout type (galley, L-shaped, U-shaped, island, peninsula, etc.)
   - Approximate room dimensions in feet
   - Traffic flow patterns
   - Work triangle efficiency

2. EXISTING FEATURES:
   - Window locations and natural light
   - Door placements
   - Ceiling height and architectural details
   - Current flooring type
   - Wall materials and colors
   - Existing appliances (if any)

3. SPACE ASSESSMENT:
   - Current cabinet style and condition
   - Counter space availability
   - Storage capacity
   - Lighting situation (natural and artificial)

4. DESIGN OPPORTUNITIES:
   - Key challenges to address
   - Space optimization potential
   - Storage improvement opportunities
   - Layout enhancement possibilities

5. STYLE RECOMMENDATIONS:
   - Which kitchen styles would work best in this space
   - Color palette suggestions based on lighting
   - Material recommendations for Calgary homes

Please be specific and detailed in your analysis, considering Calgary's climate and lifestyle.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      })

      const analysisText = analysisResponse.choices[0]?.message?.content || "Analysis not available"

      // Parse the analysis into structured data
      const spaceAnalysis = {
        roomDimensions: extractFromAnalysis(analysisText, "dimensions") || "Approximately 10' x 12' kitchen space",
        layoutType: extractFromAnalysis(analysisText, "layout") || "Standard kitchen layout",
        existingFeatures: extractFeatures(analysisText),
        challenges: extractChallenges(analysisText),
        opportunities: extractOpportunities(analysisText),
        lightingSituation: extractFromAnalysis(analysisText, "lighting") || "Natural light from windows",
        architecturalElements: extractArchitectural(analysisText),
        recommendedStyles: extractRecommendedStyles(analysisText),
        spaceOptimization: extractOptimization(analysisText),
      }

      console.log("✅ Space analysis completed successfully")

      return NextResponse.json(
        {
          success: true,
          spaceAnalysis,
          originalAnalysis: analysisText,
        },
        { headers },
      )
    } else if (action === "generate") {
      const preferences = JSON.parse(formData.get("preferences") as string)
      const contact = JSON.parse(formData.get("contact") as string)

      console.log(`🎨 Generating designs for ${contact.name} with ${preferences.kitchenStyle} style...`)

      // Log lead for Urban Woodspace
      await logLead(contact, preferences)

      // Create personalized design variations
      const designVariations = createDesignVariations(preferences)
      const designs = []
      const stats = { imagesGenerated: 0, imagesFailed: 0 }

      // Generate 3D renderings for each design
      for (const [index, designVariation] of designVariations.entries()) {
        try {
          console.log(`🖼️ Generating ${designVariation.name} design (${index + 1}/${designVariations.length})...`)

          const imagePrompt = createImagePrompt(designVariation, preferences, imageUrl)

          const imageResponse = await openai.images.generate({
            model: "dall-e-3",
            prompt: imagePrompt,
            size: "1024x1024",
            quality: "hd",
            n: 1,
          })

          const generatedImageUrl = imageResponse.data[0]?.url

          if (generatedImageUrl) {
            designs.push({
              styleName: designVariation.name,
              description: designVariation.description,
              cabinetStyle: designVariation.cabinetStyle,
              colorPalette: designVariation.colorPalette,
              keyFeatures: designVariation.keyFeatures,
              estimatedCost: calculateCost(preferences.budgetRange, designVariation.complexity),
              timeline: designVariation.timeline,
              whyThisWorks: designVariation.whyThisWorks,
              layoutOptimization: designVariation.layoutOptimization,
              storageFeatures: designVariation.storageFeatures,
              generatedImage: generatedImageUrl,
              imagePrompt: imagePrompt,
              imageStatus: "success",
            })
            stats.imagesGenerated++
            console.log(`✅ ${designVariation.name} generated successfully`)
          } else {
            throw new Error("No image URL returned")
          }
        } catch (error) {
          console.error(`❌ Failed to generate ${designVariation.name}:`, error)
          designs.push({
            styleName: designVariation.name,
            description: designVariation.description,
            cabinetStyle: designVariation.cabinetStyle,
            colorPalette: designVariation.colorPalette,
            keyFeatures: designVariation.keyFeatures,
            estimatedCost: calculateCost(preferences.budgetRange, designVariation.complexity),
            timeline: designVariation.timeline,
            whyThisWorks: designVariation.whyThisWorks,
            layoutOptimization: designVariation.layoutOptimization,
            storageFeatures: designVariation.storageFeatures,
            imageStatus: "failed",
          })
          stats.imagesFailed++
        }
      }

      console.log(`🎯 Design generation complete: ${stats.imagesGenerated} successful, ${stats.imagesFailed} failed`)

      return NextResponse.json(
        {
          success: true,
          designs,
          stats,
          message: `Generated ${stats.imagesGenerated} personalized kitchen designs for Urban Woodspace!`,
        },
        { headers },
      )
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400, headers })
  } catch (error) {
    console.error("🚨 AI design error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to process request. Please try again." },
      { status: 500, headers },
    )
  }
}

// Rate limiting function
async function checkRateLimit(request: NextRequest): Promise<{ allowed: boolean; remaining?: number }> {
  // Simple in-memory rate limiting (in production, use Redis or similar)
  const ip = request.headers.get("x-forwarded-for") || "unknown"
  const now = Date.now()
  const windowMs = 60 * 60 * 1000 // 1 hour
  const maxRequests = 10 // 10 requests per hour per IP

  // This is a simplified rate limiter - in production, use a proper solution
  return { allowed: true }
}

// Lead logging function
async function logLead(contact: any, preferences: any) {
  const leadData = {
    timestamp: new Date().toISOString(),
    name: contact.name,
    email: contact.email,
    phone: contact.phone || "Not provided",
    preferences: {
      style: preferences.kitchenStyle,
      budget: preferences.budgetRange,
      cooking: preferences.cookingHabits,
      family: preferences.familySize,
      storage: preferences.storageNeeds,
    },
    source: "AI Kitchen Designer",
  }

  console.log("📝 New lead captured:", leadData)

  // In production, you might want to:
  // - Send to CRM
  // - Email notification
  // - Save to database
  // - Send to Zapier webhook
}

// Helper functions for analysis parsing
function extractFromAnalysis(text: string, type: string): string | null {
  const lines = text.toLowerCase().split("\n")

  switch (type) {
    case "dimensions":
      const dimLine = lines.find(
        (line) =>
          line.includes("dimension") ||
          line.includes("size") ||
          line.includes("feet") ||
          line.includes("'") ||
          line.includes("x"),
      )
      return dimLine ? dimLine.trim() : null
    case "layout":
      const layoutLine = lines.find(
        (line) =>
          line.includes("layout") ||
          line.includes("galley") ||
          line.includes("l-shaped") ||
          line.includes("u-shaped") ||
          line.includes("island"),
      )
      return layoutLine ? layoutLine.trim() : null
    case "lighting":
      const lightLine = lines.find(
        (line) => line.includes("light") || line.includes("window") || line.includes("bright"),
      )
      return lightLine ? lightLine.trim() : null
    default:
      return null
  }
}

function extractFeatures(text: string): string[] {
  const features = []
  if (text.toLowerCase().includes("window")) features.push("Natural lighting from windows")
  if (text.toLowerCase().includes("ceiling")) features.push("Standard ceiling height")
  if (text.toLowerCase().includes("floor")) features.push("Existing flooring")
  if (text.toLowerCase().includes("door")) features.push("Door access points")
  return features.length > 0 ? features : ["Natural lighting", "Standard ceiling height", "Existing flooring"]
}

function extractChallenges(text: string): string[] {
  const challenges = []
  if (text.toLowerCase().includes("small") || text.toLowerCase().includes("limited")) {
    challenges.push("Limited space optimization")
  }
  if (text.toLowerCase().includes("old") || text.toLowerCase().includes("dated")) {
    challenges.push("Outdated design elements")
  }
  if (text.toLowerCase().includes("storage")) challenges.push("Insufficient storage")
  if (text.toLowerCase().includes("light")) challenges.push("Lighting improvements needed")
  return challenges.length > 0 ? challenges : ["Space optimization needed", "Storage improvements", "Lighting updates"]
}

function extractOpportunities(text: string): string[] {
  return [
    "Maximize vertical storage with tall cabinets",
    "Improve workflow with optimized layout",
    "Add modern lighting solutions",
    "Create more counter workspace",
    "Enhance storage organization",
  ]
}

function extractArchitectural(text: string): string[] {
  return ["Standard wall construction", "Existing flooring", "Window placement", "Door locations"]
}

function extractRecommendedStyles(text: string): string[] {
  const styles = []
  const textLower = text.toLowerCase()
  if (textLower.includes("modern") || textLower.includes("contemporary")) styles.push("Contemporary")
  if (textLower.includes("traditional") || textLower.includes("classic")) styles.push("Traditional")
  if (textLower.includes("transitional")) styles.push("Transitional")
  if (textLower.includes("farmhouse") || textLower.includes("rustic")) styles.push("Farmhouse")
  return styles.length > 0 ? styles : ["Contemporary", "Traditional", "Transitional"]
}

function extractOptimization(text: string): string[] {
  return [
    "Optimize work triangle efficiency",
    "Maximize storage capacity",
    "Improve traffic flow",
    "Enhance natural lighting",
  ]
}

// Design variation creation based on user preferences
function createDesignVariations(preferences: any) {
  const baseStyle = preferences.kitchenStyle
  const colorPref = preferences.colorPreference
  const budget = preferences.budgetRange
  const storage = preferences.storageNeeds
  const cooking = preferences.cookingHabits

  const variations = []

  // Primary design based on user's exact preferences
  variations.push({
    name: `Custom ${capitalizeFirst(baseStyle)} Design`,
    description: `A personalized ${baseStyle} kitchen designed specifically for your Calgary home, cooking style, and storage needs.`,
    cabinetStyle: getCabinetStyle(baseStyle, "primary"),
    colorPalette: getColorPalette(colorPref, "primary"),
    keyFeatures: getKeyFeatures(baseStyle, storage, cooking, "primary"),
    timeline: "10-12 weeks",
    complexity: "high",
    whyThisWorks: `This design perfectly matches your ${baseStyle} style preference while optimizing for your ${cooking} cooking habits and ${storage} storage needs. Perfect for Calgary's lifestyle.`,
    layoutOptimization: getLayoutOptimization(cooking, storage),
    storageFeatures: getStorageFeatures(storage, "primary"),
  })

  // Enhanced premium design
  variations.push({
    name: `Premium ${capitalizeFirst(baseStyle)} Collection`,
    description: `An elevated version of your preferred style with luxury features and enhanced functionality for the discerning Calgary homeowner.`,
    cabinetStyle: getCabinetStyle(baseStyle, "enhanced"),
    colorPalette: getColorPalette(colorPref, "enhanced"),
    keyFeatures: getKeyFeatures(baseStyle, storage, cooking, "enhanced"),
    timeline: "12-14 weeks",
    complexity: "premium",
    whyThisWorks: `This premium design builds on your style preferences with luxury materials and advanced storage solutions for the ultimate Calgary kitchen experience.`,
    layoutOptimization: getLayoutOptimization(cooking, storage, "enhanced"),
    storageFeatures: getStorageFeatures(storage, "enhanced"),
  })

  // Value-conscious alternative
  variations.push({
    name: `Smart ${capitalizeFirst(baseStyle)} Value`,
    description: `A cost-effective approach to your preferred style without compromising on Urban Woodspace quality or functionality.`,
    cabinetStyle: getCabinetStyle(baseStyle, "value"),
    colorPalette: getColorPalette(colorPref, "value"),
    keyFeatures: getKeyFeatures(baseStyle, storage, cooking, "value"),
    timeline: "8-10 weeks",
    complexity: "standard",
    whyThisWorks: `This design delivers your desired ${baseStyle} aesthetic with smart material choices and efficient layouts that maximize value for Calgary families.`,
    layoutOptimization: getLayoutOptimization(cooking, storage, "value"),
    storageFeatures: getStorageFeatures(storage, "value"),
  })

  return variations
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getCabinetStyle(style: string, tier: string): string {
  const styles = {
    contemporary: {
      primary: "Flat-panel doors with sleek brushed hardware",
      enhanced: "Handleless flat-panel with integrated pulls and soft-close",
      value: "Clean flat-panel with modern hardware",
    },
    traditional: {
      primary: "Raised-panel doors with classic brass hardware",
      enhanced: "Detailed raised-panel with crown molding and premium finishes",
      value: "Simple raised-panel with traditional pulls",
    },
    transitional: {
      primary: "Shaker-style doors with brushed nickel hardware",
      enhanced: "Premium Shaker with soft-close mechanisms and custom details",
      value: "Classic Shaker with standard hardware",
    },
    modern: {
      primary: "Ultra-flat doors with minimal linear hardware",
      enhanced: "Integrated handle-less design with push-to-open",
      value: "Simple flat doors with sleek pulls",
    },
    farmhouse: {
      primary: "Beadboard doors with rustic bronze hardware",
      enhanced: "Detailed farmhouse with decorative elements and vintage accents",
      value: "Simple farmhouse style with classic pulls",
    },
    scandinavian: {
      primary: "Light wood doors with minimal black hardware",
      enhanced: "Premium wood grain with integrated handles and natural finishes",
      value: "Natural wood with simple hardware",
    },
    industrial: {
      primary: "Metal-accented doors with industrial black hardware",
      enhanced: "Mixed materials with exposed elements and custom metalwork",
      value: "Industrial-inspired with metal accents",
    },
  }

  return (
    styles[style as keyof typeof styles]?.[tier as keyof (typeof styles)[keyof typeof styles]] || "Custom cabinet style"
  )
}

function getColorPalette(colorPref: string, tier: string): string {
  const palettes = {
    "light-neutral": {
      primary: "Crisp whites with warm gray accents and quartz counters",
      enhanced: "Premium whites with marble-inspired veining and gold accents",
      value: "Clean whites with subtle gray undertones",
    },
    "dark-dramatic": {
      primary: "Deep charcoal with contrasting light quartz counters",
      enhanced: "Rich navy with brass accent hardware and marble backsplash",
      value: "Dark gray with white contrast elements",
    },
    "warm-wood": {
      primary: "Natural oak with complementary earth tones and granite",
      enhanced: "Premium walnut with brass accents and natural stone",
      value: "Warm maple with classic finishes",
    },
    "two-tone": {
      primary: "White uppers with gray lowers and coordinated hardware",
      enhanced: "Contrasting island with premium coordinated colors and finishes",
      value: "Simple two-tone with balanced contrast",
    },
    "bold-colors": {
      primary: "Custom color with neutral balance and modern accents",
      enhanced: "Rich color with premium accent materials and designer touches",
      value: "Tasteful color with classic combinations",
    },
  }

  return (
    palettes[colorPref as keyof typeof palettes]?.[tier as keyof (typeof palettes)[keyof typeof palettes]] ||
    "Custom color palette designed for your space"
  )
}

function getKeyFeatures(style: string, storage: string, cooking: string, tier: string): string[] {
  const baseFeatures = {
    primary: [
      "Soft-close doors and drawers",
      "Under-cabinet LED lighting",
      "Quartz countertops",
      "Custom storage solutions",
      "Premium hardware finishes",
      "Professional installation",
    ],
    enhanced: [
      "Premium soft-close mechanisms",
      "Integrated LED lighting system",
      "Luxury quartz with waterfall edge",
      "Advanced storage organization",
      "Designer hardware collection",
      "Built-in charging stations",
      "Custom crown molding",
    ],
    value: [
      "Quality soft-close hinges",
      "LED under-cabinet strips",
      "Durable quartz surfaces",
      "Efficient storage design",
      "Stylish hardware selection",
      "Professional installation",
    ],
  }

  return baseFeatures[tier as keyof typeof baseFeatures] || baseFeatures.primary
}

function getLayoutOptimization(cooking: string, storage: string, tier = "primary"): string[] {
  const optimizations = []

  if (cooking.includes("daily") || cooking.includes("frequent")) {
    optimizations.push("Optimized work triangle for efficient cooking")
    optimizations.push("Multiple prep areas for complex meals")
  }

  if (cooking.includes("entertainer")) {
    optimizations.push("Open layout for social cooking and entertaining")
    optimizations.push("Extended counter space for serving guests")
  }

  if (storage.includes("maximum")) {
    optimizations.push("Floor-to-ceiling storage maximization")
    optimizations.push("Corner cabinet optimization with lazy susans")
  }

  if (tier === "enhanced") {
    optimizations.push("Smart appliance integration zones")
    optimizations.push("Hidden storage solutions and secret compartments")
  }

  return optimizations.length > 0
    ? optimizations
    : ["Improved workflow efficiency", "Optimized storage placement", "Enhanced counter workspace"]
}

function getStorageFeatures(storage: string, tier: string): string[] {
  const features = {
    "maximum-storage": [
      "Floor-to-ceiling cabinets with crown molding",
      "Deep drawer systems with full extension slides",
      "Corner cabinet solutions with lazy susans",
      "Pantry organization systems with pull-out shelves",
    ],
    "organized-storage": [
      "Pull-out drawer organizers with dividers",
      "Spice rack systems and condiment storage",
      "Divided storage compartments for utensils",
      "Lazy Susan corner units for easy access",
    ],
    "display-storage": [
      "Glass-front upper cabinets with interior lighting",
      "Open shelving displays for decorative items",
      "Wine storage features and glass racks",
      "Decorative storage elements and display niches",
    ],
    "hidden-storage": [
      "Integrated appliance panels for seamless look",
      "Hidden storage compartments and secret drawers",
      "Seamless cabinet integration with walls",
      "Concealed organization systems behind doors",
    ],
    "pantry-storage": [
      "Walk-in pantry design with custom shelving",
      "Pull-out pantry systems with wire baskets",
      "Food storage organization with clear containers",
      "Bulk storage solutions for Calgary families",
    ],
  }

  const baseFeatures = features[storage as keyof typeof features] || [
    "Custom storage solutions tailored to your needs",
    "Organized cabinet interiors with adjustable shelves",
    "Efficient space utilization for Calgary homes",
    "Quality storage hardware with lifetime warranty",
  ]

  if (tier === "enhanced") {
    return [...baseFeatures, "Smart storage technology integration", "Premium organization systems with soft-close"]
  }

  return baseFeatures
}

function calculateCost(budgetRange: string, complexity: string): string {
  const budgetMultipliers = {
    "25k-40k": { min: 25000, max: 40000 },
    "40k-60k": { min: 40000, max: 60000 },
    "60k-80k": { min: 60000, max: 80000 },
    "80k-100k": { min: 80000, max: 100000 },
    "100k-plus": { min: 100000, max: 150000 },
  }

  const complexityMultipliers = {
    standard: 0.85,
    high: 1.0,
    premium: 1.25,
  }

  const budget = budgetMultipliers[budgetRange as keyof typeof budgetMultipliers] || { min: 35000, max: 50000 }
  const multiplier = complexityMultipliers[complexity as keyof typeof complexityMultipliers] || 1.0

  const minCost = Math.round(budget.min * multiplier)
  const maxCost = Math.round(budget.max * multiplier)

  return `$${minCost.toLocaleString()} - $${maxCost.toLocaleString()} CAD`
}

function createImagePrompt(design: any, preferences: any, originalImageUrl: string): string {
  const style = preferences.kitchenStyle
  const colorPref = preferences.colorPreference
  const cooking = preferences.cookingHabits
  const family = preferences.familySize

  let prompt = `A stunning, photorealistic 3D rendering of a ${style} kitchen design for Urban Woodspace Calgary. `

  // Add style-specific details
  if (style === "contemporary") {
    prompt += "Clean lines, flat-panel cabinets, minimalist design with sleek hardware and modern appliances. "
  } else if (style === "traditional") {
    prompt +=
      "Classic raised-panel cabinets, elegant details, timeless design with traditional hardware and warm finishes. "
  } else if (style === "transitional") {
    prompt += "Shaker-style cabinets blending traditional and modern elements with versatile hardware. "
  } else if (style === "modern") {
    prompt += "Ultra-modern design with handleless cabinets, cutting-edge features, and minimalist aesthetics. "
  } else if (style === "farmhouse") {
    prompt += "Rustic farmhouse charm with beadboard details, vintage-inspired elements, and cozy warmth. "
  } else if (style === "scandinavian") {
    prompt += "Light wood tones, natural materials, bright and airy Scandinavian design with clean lines. "
  } else if (style === "industrial") {
    prompt += "Industrial aesthetic with metal accents, urban design elements, and modern functionality. "
  }

  // Add color palette
  prompt += `Color scheme: ${design.colorPalette}. `

  // Add layout considerations
  if (cooking.includes("daily") || cooking.includes("frequent")) {
    prompt += "Efficient work triangle layout with multiple prep areas and professional-grade workflow. "
  }

  if (cooking.includes("entertainer")) {
    prompt += "Open layout perfect for entertaining with large island and social cooking areas. "
  }

  // Add family size considerations
  if (family.includes("large")) {
    prompt += "Spacious design accommodating large family needs with ample storage and workspace. "
  }

  // Add technical specifications
  prompt += `${design.cabinetStyle}. Premium quartz countertops, under-cabinet LED lighting, high-end stainless steel appliances. `

  // Add storage features
  prompt += `Storage features: ${design.storageFeatures.slice(0, 3).join(", ")}. `

  // Add Calgary-specific elements
  prompt += "Designed for Calgary homes with practical storage for winter gear and seasonal items. "

  // Add final quality specifications
  prompt +=
    "Professional architectural photography style, perfect natural lighting, 4K quality, hyperrealistic rendering. The kitchen should look like a high-end interior design magazine photo with perfect staging, warm lighting, and inviting atmosphere. Show the space as lived-in and welcoming for a Calgary family."

  return prompt
}
