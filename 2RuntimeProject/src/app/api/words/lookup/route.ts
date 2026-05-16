import { type NextRequest } from "next/server";
import { lookupPinyin, lookupEnglish } from "@/lib/dictionary";
import { GoogleGenAI } from "@google/genai";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Common multi-character word translations.
 * These are words that frequently appear in children's stories
 * where the combined meaning differs from individual characters.
 */
const COMPOUND_WORDS: Record<string, string> = {
  "学校": "school",
  "老师": "teacher",
  "同学": "classmate",
  "朋友": "friend",
  "妈妈": "mother; mom",
  "爸爸": "father; dad",
  "爷爷": "grandfather",
  "奶奶": "grandmother",
  "姐姐": "older sister",
  "哥哥": "older brother",
  "弟弟": "younger brother",
  "妹妹": "younger sister",
  "孩子": "child; children",
  "学生": "student",
  "今天": "today",
  "明天": "tomorrow",
  "昨天": "yesterday",
  "早上": "morning",
  "晚上": "evening; night",
  "下午": "afternoon",
  "上午": "morning (before noon)",
  "时候": "time; moment",
  "地方": "place",
  "东西": "thing; stuff",
  "什么": "what",
  "怎么": "how; why",
  "为什么": "why",
  "因为": "because",
  "所以": "so; therefore",
  "但是": "but; however",
  "虽然": "although",
  "如果": "if",
  "已经": "already",
  "非常": "very; extremely",
  "可以": "can; may",
  "应该": "should; ought to",
  "知道": "know",
  "喜欢": "like; enjoy",
  "高兴": "happy; glad",
  "快乐": "happy; joyful",
  "漂亮": "beautiful; pretty",
  "好看": "good-looking",
  "认真": "serious; earnest",
  "努力": "work hard; effort",
  "开心": "happy; delighted",
  "生气": "angry",
  "害怕": "afraid; scared",
  "着急": "anxious; worried",
  "小心": "careful; be careful",
  "回家": "go home",
  "上学": "go to school",
  "吃饭": "eat (a meal)",
  "睡觉": "sleep",
  "起床": "get up (from bed)",
  "看书": "read a book",
  "写字": "write characters",
  "说话": "speak; talk",
  "唱歌": "sing (a song)",
  "跳舞": "dance",
  "画画": "draw; paint",
  "做作业": "do homework",
  "动物": "animal",
  "植物": "plant",
  "花园": "garden",
  "公园": "park",
  "图书馆": "library",
  "医院": "hospital",
  "超市": "supermarket",
  "电视": "television; TV",
  "电话": "telephone",
  "手机": "mobile phone",
  "自行车": "bicycle",
  "汽车": "car; automobile",
  "火车": "train",
  "飞机": "airplane",
  "天气": "weather",
  "春天": "spring",
  "夏天": "summer",
  "秋天": "autumn; fall",
  "冬天": "winter",
  "太阳": "sun",
  "月亮": "moon",
  "星星": "star",
  "下雨": "rain",
  "下雪": "snow",
  "刮风": "windy",
  "衣服": "clothes",
  "鞋子": "shoes",
  "帽子": "hat; cap",
  "眼睛": "eye; eyes",
  "耳朵": "ear; ears",
  "鼻子": "nose",
  "嘴巴": "mouth",
  "头发": "hair",
  "身体": "body",
  "苹果": "apple",
  "西瓜": "watermelon",
  "葡萄": "grape",
  "香蕉": "banana",
  "蔬菜": "vegetable",
  "水果": "fruit",
  "面包": "bread",
  "牛奶": "milk",
  "鸡蛋": "egg",
  "米饭": "rice (cooked)",
  "蝴蝶": "butterfly",
  "蜘蛛": "spider",
  "蚂蚁": "ant",
  "小鸟": "little bird",
  "金鱼": "goldfish",
  "熊猫": "panda",
  "故事": "story",
  "问题": "question; problem",
  "办法": "method; way",
  "意思": "meaning",
  "名字": "name",
  "作业": "homework",
  "考试": "exam; test",
  "练习": "practice; exercise",
  "游戏": "game",
  "比赛": "competition; match",
  "节日": "festival; holiday",
  "生日": "birthday",
  "礼物": "gift; present",
  "世界": "world",
  "国家": "country; nation",
  "城市": "city",
  "农村": "countryside",
  "历史": "history",
  "科学": "science",
  "数学": "mathematics",
  "音乐": "music",
  "美术": "art",
  "体育": "physical education; sports",
};

/**
 * GET /api/words/lookup?text=学校
 * Look up pinyin and English for any Chinese text (single char or multi-char word).
 * Falls back to Gemini for words not in the local dictionary.
 */
export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text");

  if (!text) {
    return Response.json(
      { error: "text query parameter is required" },
      { status: 400 }
    );
  }

  // Get pinyin for the full text (pinyin-pro handles multi-char words natively)
  const pinyinResult = lookupPinyin(text);

  // For English: check compound dictionary first, then single-char dictionary
  let english = "";
  if (text.length > 1) {
    english = COMPOUND_WORDS[text] || "";
  }
  if (!english) {
    english = lookupEnglish(text);
  }

  // If no English found and it's a multi-char word, ask Gemini
  if (!english && text.length > 1) {
    english = await translateWithGemini(text);
  }

  return Response.json({
    character: text,
    pinyin: pinyinResult || "",
    english: english || "",
  });
}

// Simple in-memory cache for Gemini translations to avoid repeated API calls
const translationCache = new Map<string, string>();

async function translateWithGemini(text: string): Promise<string> {
  if (translationCache.has(text)) {
    return translationCache.get(text)!;
  }

  try {
    let apiKey = process.env.GEMINI_API_KEY || null;
    if (!apiKey) {
      const keyFile = resolve(/* turbopackIgnore: true */ process.cwd(), "data/gemini-key.json");
      if (existsSync(keyFile)) {
        const content = readFileSync(keyFile, "utf-8");
        const parsed = JSON.parse(content);
        apiKey = parsed.apiKey || null;
      }
    }
    if (!apiKey) return "";

    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate this Chinese word to English. Reply with ONLY the English meaning/definition, not pinyin or romanization. If it is a proper noun or place name, give the English meaning of the characters. Keep it brief (1-5 words). Word: ${text}`,
    });

    const result = response.text?.trim() || "";
    // Cache it for future lookups
    translationCache.set(text, result);
    return result;
  } catch {
    return "";
  }
}
