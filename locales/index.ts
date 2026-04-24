

const commonTranslations = {
    // Shared
    main_title: "Your Home Art Show",
    // Errors
    error_set_api_key: "Please set your API Key first.",
    error_enhance_failed: "Failed to enhance the photo.",
    error_upload_room: "Please upload a room photo.",
    error_select_art: "Please select at least one piece of art.",
    error_generation_failed: "An unknown error occurred during image generation.",
    error_edit_failed: "Image editing failed.",
};

const translations = {
  en: {
    ...commonTranslations,
    // Header
    subtitle: "Create your private art gallery",
    description: "Upload a photo of your space and your artworks to see how they look.",
    clear_api_key_button: "Change API Key",
    // API Key Input
    api_key_title: "API Key Required",
    api_key_description: "Please enter your Google Gemini API Key to continue. Your key is stored locally in your browser.",
    api_key_placeholder: "Enter your Gemini API Key",
    api_key_submit_button: "Save & Continue",
    api_key_helper_text_1: "Get an API Key from",
    api_key_helper_text_2: "Google AI Studio",
    // Main page
    your_space_title: "1. Your Space Photo",
    artwork_title: "2. Your Artwork",
    generate_button: "Generate",
    // Image Uploader
    enhancing_space: "Enhancing your space...",
    upload_prompt: "Click or drag & drop to upload",
    upload_formats: "PNG, JPG, or WEBP",
    // Art Gallery
    user_art_title: 'Your Artwork',
    user_art_artist: 'You',
    upload_artwork_prompt: "Upload an artwork",
    // Loading Indicator
    generating_title: "Generating...",
    // Result Display
    compare_slider_title: "Drag slider to compare",
    original_label: "Original",
    effect_label: "Effect",
    done_button: "Done",
    cancel_button: "Cancel",
    applying_edits: "Applying edits...",
    detail_adjustment_title: "Detail Adjustment",
    frame_materials_label: "Frame Materials",
    frame_color_label: "Frame Color",
    mounting_methods_label: "Framing & Mounting",
    glazing_protection_label: "Glazing & Protection",
    none_option: "None",
    text_prompt_label: "Modify with text",
    mask_selected_label: "(Mask selected)",
    text_prompt_placeholder: "e.g., move the largest painting a bit to the left",
    brush_label: "Select area to edit",
    brush_label_short: "Brush",
    regenerate_button: "Regenerate",
    download_button: "Download",
    start_over_button: "Start Over",
    replace_artwork_label: "Replace Artwork",
    new_artwork_alt: "New artwork preview",
    upload_new_art_prompt: "Upload new artwork",
    upload_button: "Upload...",
    clear_button: "Clear",
    replace_artwork_prompt: "Click to upload a replacement",
    undo_button: "Undo Last Edit",
  },
  zh: {
    ...commonTranslations,
    // Header
    subtitle: "打造您的私人美术馆",
    description: "上传您的空间照片和艺术作品看看效果",
    clear_api_key_button: "更换 API Key",
    // API Key Input
    api_key_title: "需要 API Key",
    api_key_description: "请输入您的 Google Gemini API Key 以继续。您的密钥将本地存储在您的浏览器中。",
    api_key_placeholder: "输入您的 Gemini API Key",
    api_key_submit_button: "保存并继续",
    api_key_helper_text_1: "从",
    api_key_helper_text_2: "Google AI Studio",
    // Main page
    your_space_title: "1. 您的空间照片",
    artwork_title: "2. 您的艺术作品",
    generate_button: "生成",
    // Image Uploader
    enhancing_space: "正在美化空间...",
    upload_prompt: "点击或拖拽上传",
    upload_formats: "PNG, JPG, 或 WEBP",
    // Art Gallery
    user_art_title: '您的艺术品',
    user_art_artist: '您',
    upload_artwork_prompt: "上传一件艺术品",
    // Loading Indicator
    generating_title: "生成中...",
    // Result Display
    compare_slider_title: "拖动滑块对比",
    original_label: "原始",
    effect_label: "效果",
    done_button: "完成",
    cancel_button: "取消",
    applying_edits: "正在应用编辑...",
    detail_adjustment_title: "细节调整",
    frame_materials_label: "画框材质",
    frame_color_label: "画框颜色",
    mounting_methods_label: "装裱方式",
    glazing_protection_label: "玻璃/防护",
    none_option: "无",
    text_prompt_label: "输入文字进行修改",
    mask_selected_label: "(已圈选区域)",
    text_prompt_placeholder: "去掉我圈选的植物/灯/茶杯……",
    brush_label: "圈选编辑区域",
    brush_label_short: "范围",
    regenerate_button: "再次生成",
    download_button: "下载",
    start_over_button: "重新开始",
    replace_artwork_label: "更换作品对比效果",
    new_artwork_alt: "新艺术品预览",
    upload_new_art_prompt: "上传新作品",
    upload_button: "上传...",
    clear_button: "清除",
    replace_artwork_prompt: "点击上传",
    undo_button: "返回上一步",
  },
};

const AGENT_STEPS = {
    en: [
        'Analyzing room photo...',
        'Converting to design blueprint...',
        'Identifying perfect wall space...',
        'Placing artwork with realistic perspective...',
        'Blending natural light and shadows...',
        'Rendering final high-res image...',
    ],
    zh: [
        '分析房间照片...',
        '转化为设计效果图...',
        '识别完美的墙面空间...',
        '以逼真的视角放置艺术品...',
        '融合自然光线与阴影...',
        '渲染最终高清图像...',
    ]
};

const framingOptions = {
  materials: [
    {
      category: { en: 'Frames for Home Use', zh: '画框材质' },
      items: [
        { en: 'Solid Wood (Walnut, Oak, Pine, Natural Wood)', zh: '实木框（胡桃木、橡木、松木、原木色）' },
        { en: 'Aluminum (Black, Silver, Gold)', zh: '铝合金框（黑色、银色、金色）' },
        { en: 'Acrylic (Transparent, Frameless effect)', zh: '亚克力框（透明、无框效果）' },
        { en: 'Resin Ornamental (Antique Gold, Antique Silver)', zh: '树脂雕花框（仿古金、仿古银）' },
      ],
    },
  ],
  mounting: [
    {
      category: { en: 'Mounting Methods for Home Use', zh: '装裱方式' },
      items: [
        { en: 'Single Mat', zh: '单层卡纸（Single Mat）' },
        { en: 'Double Mat', zh: '双层卡纸（Double Mat）' },
        { en: 'Stretched Canvas', zh: '绷框（Stretched Canvas）' },
        { en: 'Floating Frame', zh: '浮框（Floating Frame）' },
        { en: 'Frameless Mounting', zh: '无框画（Frameless Mounting）' },
        { en: 'Magnetic Poster Hanger', zh: '磁吸装裱（Magnetic Poster Hanger）' },
      ],
    },
  ],
  glazing: [
    {
      category: { en: 'Glazing & Protection for Home Use', zh: '玻璃/防护' },
      items: [
        { en: 'Standard Glass', zh: '普通玻璃（Standard Glass）' },
        { en: 'Acrylic Glazing', zh: '亚克力板（Acrylic Glazing）' },
        { en: 'Anti-glare Glass', zh: '防反射玻璃（Anti-glare Glass）' },
        { en: 'UV Glass', zh: '防紫外线玻璃（UV Glass）' },
      ]
    }
  ],
  colors: [
    {
      category: { en: 'Frame Colors for Home Use', zh: '常见画框颜色' },
      items: [
        { en: 'Black', zh: '黑色（Black）' },
        { en: 'White', zh: '白色（White）' },
        { en: 'Natural Wood', zh: '原木色（Natural Wood）' },
        { en: 'Dark Wood (Walnut / Mahogany)', zh: '深木色（Walnut / Mahogany）' },
        { en: 'Gold', zh: '金色（Gold）' },
        { en: 'Silver', zh: '银色（Silver）' },
        { en: 'Gray', zh: '灰色（Gray）' },
      ]
    }
  ]
};

export { translations, AGENT_STEPS, framingOptions };
