package com.eggscan.service;

import com.eggscan.dto.AIInsights;
import com.eggscan.model.ContributionStats;
import com.eggscan.model.ScanResult;
import com.eggscan.dto.CommitShameResponse;
import com.eggscan.dto.ReadmeRaterResponse;
import com.eggscan.dto.StackRoastResponse;
import com.eggscan.dto.RepoDeepDiveResponse;
import com.eggscan.model.PinnedRepo;
import com.eggscan.model.GitHubTreeResponse;
import com.eggscan.model.GitHubCommitResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
@Slf4j
public class AIAnalyzerService {

    private final GroqService groq;
    private static final Pattern EMOJI_PATTERN = Pattern.compile("[\\x{1F600}-\\x{1F64F}\\x{1F300}-\\x{1F5FF}\\x{1F680}-\\x{1F6FF}\\x{1F700}-\\x{1F77F}\\x{1F780}-\\x{1F7FF}\\x{1F800}-\\x{1F8FF}\\x{1F900}-\\x{1F9FF}\\x{1FA00}-\\x{1FA6F}\\x{1FA70}-\\x{1FAFF}\\x{2600}-\\x{26FF}\\x{2700}-\\x{27BF}]");
    private static final Pattern WHITESPACE_PATTERN = Pattern.compile("\\s+");

    public AIAnalyzerService(GroqService groq) {
        this.groq = groq;
    }

    public AIInsights analyze(ScanResult scan, ContributionStats stats, Map<String, String> readmes, String mode) {
        String basePrompt = "You are an AI scanning a developer's GitHub profile. " +
                "You must analyze their stats, repositories, and README excerpts. " +
                "Determine their EggScore (0-100) and an EggVerdict ('Golden Egg', 'Hard Boiled', 'Fresh Egg', 'Cracked', 'Scrambled'). " +
                "Provide a brutally honest recruiter impression, actual technical skills demonstrated, and harsh areas for improvement. " +
                "Provide a single 'vibe' word. Also, invent a humorous 'predictedJobTitle' (e.g. 'Senior YAML Engineer'), a joke 'predictedSalary' (e.g. 'Paid in exposure'), and a 'githubWrapped' sentence (e.g. 'You coded most on Sundays, do you have a life?') based on their profile data.";

        String tone = switch (mode == null ? "honest" : mode.toLowerCase(java.util.Locale.ROOT)) {
            case "professional" -> "Be polite, constructive, and highly professional.";
            case "roast" -> "Be absolutely brutal. Roast them. Make them question their career choices.";
            case "hype" -> "Be an over-enthusiastic tech startup founder. Everything is a paradigm shift.";
            case "pirate" -> "Talk like a salty sea captain reviewing a deckhand's work.";
            default -> "Be a tired, cynical, brutally honest tech recruiter.";
        };

        String schema = "Respond with valid JSON: { \"firstImpression\": \"\", \"skills\": [], \"improvements\": [], \"vibe\": \"\", \"eggScore\": 0, \"eggVerdict\": \"\", \"predictedJobTitle\": \"\", \"predictedSalary\": \"\", \"githubWrapped\": \"\" }";

        String prompt = basePrompt + " " + tone + " " + schema;
        String context = buildContext(scan, stats, readmes);

        com.fasterxml.jackson.databind.JsonNode json = groq.chatJson(prompt, context);

        AIInsights out = new AIInsights();
        out.setFirstImpression(stripEmoji(json.path("firstImpression").asText()));
        out.setVibe(stripEmoji(json.path("vibe").asText()));
        out.setEggScore(clamp(json.path("eggScore").asInt(50)));

        String rawVerdict = stripEmoji(json.path("eggVerdict").asText());
        if (!List.of("Golden Egg", "Hard Boiled", "Fresh Egg", "Cracked", "Scrambled").contains(rawVerdict)) {
            rawVerdict = "Fresh Egg";
        }
        out.setEggVerdict(rawVerdict);
        out.setPredictedJobTitle(stripEmoji(json.path("predictedJobTitle").asText()));
        out.setPredictedSalary(stripEmoji(json.path("predictedSalary").asText()));
        out.setGithubWrapped(stripEmoji(json.path("githubWrapped").asText()));

        List<String> skills = new ArrayList<>();
        json.path("skills").forEach(n -> skills.add(stripEmoji(n.asText())));
        out.setSkills(skills);

        List<String> improvements = new ArrayList<>();
        json.path("improvements").forEach(n -> improvements.add(stripEmoji(n.asText())));
        out.setImprovements(improvements);

        return out;
    }

    public String battle(ScanResult scan1, ContributionStats stats1, ScanResult scan2, ContributionStats stats2) {
        String prompt = "You are an aggressive fighting game announcer. Two developers are battling. Read their stats and declare a winner in exactly one paragraph. Roast the loser. Hype the winner. Be highly entertaining.";

        StringBuilder context = new StringBuilder();
        context.append("--- PLAYER 1: ").append(scan1.getProfile().getLogin()).append(" ---\n");
        context.append("Total Stars: ").append(scan1.getTotalStars()).append("\n");
        context.append("Contributions: ").append(stats1.getTotalContributionsLastYear()).append("\n");
        context.append("Public Repos: ").append(scan1.getProfile().getPublic_repos()).append("\n\n");

        context.append("--- PLAYER 2: ").append(scan2.getProfile().getLogin()).append(" ---\n");
        context.append("Total Stars: ").append(scan2.getTotalStars()).append("\n");
        context.append("Contributions: ").append(stats2.getTotalContributionsLastYear()).append("\n");
        context.append("Public Repos: ").append(scan2.getProfile().getPublic_repos()).append("\n\n");

        context.append("Respond with JSON: { \"winner\": \"username\", \"report\": \"your paragraph here\" }");

        try {
            com.fasterxml.jackson.databind.JsonNode json = groq.chatJson(prompt, context.toString());
            return json.path("winner").asText() + "|||" + stripEmoji(json.path("report").asText());
        } catch (Exception e) {
            // Empty winner: ScanService awards the battle to the higher EggScore.
            log.warn("Battle commentary failed: {}", e.getMessage());
            return "|||The announcer lost their voice, so the scoreboard decides this one.";
        }
    }

    private int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }

    private String stripEmoji(String input) {
        if (input == null) return "";
        String cleaned = EMOJI_PATTERN.matcher(input).replaceAll("");
        return WHITESPACE_PATTERN.matcher(cleaned).replaceAll(" ").trim();
    }

    private String buildContext(ScanResult scan, ContributionStats stats, Map<String, String> readmes) {
        StringBuilder sb = new StringBuilder();

        appendProfile(sb, scan);
        appendActivity(sb, stats, scan);
        appendLanguages(sb, scan);
        appendPinnedRepos(sb, stats);
        appendTopRepos(sb, scan);
        appendReadmeSnippets(sb, readmes);

        sb.append("Now produce the JSON analysis. Be honest. Be specific. No filler.");
        return sb.toString();
    }

    private void appendProfile(StringBuilder sb, ScanResult scan) {
        var p = scan.getProfile();
        sb.append("=== PROFILE ===\n");
        sb.append("Login: ").append(p.getLogin()).append("\n");
        sb.append("Name: ").append(nullSafe(p.getName())).append("\n");
        sb.append("Bio: ").append(nullSafe(p.getBio())).append("\n");
        sb.append("Company: ").append(nullSafe(p.getCompany())).append("\n");
        sb.append("Location: ").append(nullSafe(p.getLocation())).append("\n");
        sb.append("Public repos: ").append(p.getPublic_repos()).append("\n");
        sb.append("Followers: ").append(p.getFollowers()).append("\n");
        sb.append("Joined: ").append(p.getCreated_at()).append("\n\n");
    }

    private void appendActivity(StringBuilder sb, ContributionStats stats, ScanResult scan) {
        sb.append("=== ACTIVITY ===\n");
        sb.append("Contributions last year: ").append(stats.getTotalContributionsLastYear()).append("\n");
        sb.append("Issues opened: ").append(stats.getTotalIssues()).append("\n");
        sb.append("Pull requests: ").append(stats.getTotalPullRequests()).append("\n");
        sb.append("Active repos (pushed in 180d): ").append(scan.getActiveRepos()).append("\n");
        sb.append("Total stars across own repos: ").append(scan.getTotalStars()).append("\n");
        sb.append("Last push: ").append(scan.getLastActivity()).append("\n\n");
    }

    private void appendLanguages(StringBuilder sb, ScanResult scan) {
        sb.append("=== LANGUAGES (own repos) ===\n");
        Optional.ofNullable(scan.getLanguageBreakdown()).orElse(Map.of()).entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .forEach(e -> sb.append("- ").append(e.getKey()).append(": ").append(e.getValue()).append(" repo(s)\n"));
        sb.append("\n");
    }

    private void appendPinnedRepos(StringBuilder sb, ContributionStats stats) {
        sb.append("=== PINNED REPOS ===\n");
        if (stats.getPinnedRepos() == null || stats.getPinnedRepos().isEmpty()) {
            sb.append("(none — recruiter sees random repos instead)\n");
        } else {
            for (PinnedRepo pr : stats.getPinnedRepos()) {
                sb.append("- ").append(pr.getName())
                        .append(" [").append(nullSafe(pr.getPrimaryLanguage())).append("] ")
                        .append("stars:").append(pr.getStars())
                        .append(" — ").append(nullSafe(pr.getDescription())).append("\n");
            }
        }
        sb.append("\n");
    }

    private void appendTopRepos(StringBuilder sb, ScanResult scan) {
        sb.append("=== TOP REPOS (sample) ===\n");
        Optional.ofNullable(scan.getRepos()).orElse(List.of()).stream().limit(10).forEach(r -> {
            sb.append("- ").append(r.getName())
                    .append(" [").append(nullSafe(r.getLanguage())).append("] ")
                    .append("stars:").append(Optional.ofNullable(r.getStargazers_count()).orElse(0))
                    .append(" — ").append(nullSafe(r.getDescription()))
                    .append(" (last push: ").append(nullSafe(r.getPushed_at())).append(")\n");
        });
        sb.append("\n");
    }

    private void appendReadmeSnippets(StringBuilder sb, Map<String, String> readmes) {
        sb.append("=== README SNIPPETS ===\n");
        int reposWithReadme = 0;
        for (var entry : readmes.entrySet()) {
            String body = entry.getValue();
            if (body == null || body.isBlank()) {
                sb.append("[").append(entry.getKey()).append("] (NO README)\n\n");
            } else {
                reposWithReadme++;
                sb.append("[").append(entry.getKey()).append("]\n");
                sb.append(body.length() > 800 ? body.substring(0, 800) + "..." : body).append("\n\n");
            }
        }
        sb.append("README coverage: ").append(reposWithReadme).append(" of ").append(readmes.size()).append(" top repos\n\n");
    }

    private String nullSafe(Object o) {
        return o == null ? "(none)" : o.toString();
    }


    public RepoDeepDiveResponse analyzeRepository(String username, String repoName, String readme, GitHubTreeResponse tree, Map<String, String> configFiles, List<GitHubCommitResponse> commits) {
        StringBuilder context = new StringBuilder();
        context.append("=== REPOSITORY: ").append(username).append("/").append(repoName).append(" ===\n");

        context.append("\n--- README ---\n");
        if (readme != null && !readme.isBlank()) {
            context.append(readme.length() > 1500 ? readme.substring(0, 1500) + "..." : readme).append("\n");
        } else {
            context.append("(No README found)\n");
        }

        context.append("\n--- FILE TREE (Root/Key Folders) ---\n");
        if (tree != null && tree.getTree() != null) {
            tree.getTree().stream()
                .limit(50)
                .forEach(item -> context.append(item.getPath()).append("tree".equals(item.getType()) ? "/" : "").append("\n"));
        }

        context.append("\n--- CONFIG FILES ---\n");
        for (Map.Entry<String, String> entry : configFiles.entrySet()) {
            context.append("[").append(entry.getKey()).append("]\n");
            String content = entry.getValue();
            context.append(content.length() > 500 ? content.substring(0, 500) + "..." : content).append("\n\n");
        }

        context.append("\n--- RECENT COMMITS ---\n");
        if (commits != null) {
            commits.stream()
                    .map(GitHubService::messageOf)
                    .filter(java.util.Objects::nonNull)
                    .forEach(message -> context.append("- ").append(message.replace("\n", " ")).append("\n"));
        }

        String prompt = "You are a senior staff engineer performing a deep architectural and code quality review on a GitHub repository.\n" +
            "Analyze the provided README, file tree, key configuration files, and recent commit messages.\n\n" +
            "You ALWAYS respond with valid JSON matching this exact shape:\n" +
            "{\n" +
            "  \"summary\": \"A concise 2-sentence summary of what this repository is and its apparent maturity.\",\n" +
            "  \"architectureAndStack\": \"Analysis of the tech stack (inferred from configs) and overall architectural approach.\",\n" +
            "  \"codeStructureFeedback\": \"Critique of the folder/file structure. Is it standard? Messy? Well-organized?\",\n" +
            "  \"commitQualityFeedback\": \"Review of their commit message habits. Are they descriptive or just 'wip'?\",\n" +
            "  \"actionableImprovements\": [\"Specific fix 1\", \"Specific fix 2\"]\n" +
            "}\n\n" +
            "Be constructive, highly technical, and direct. Do not use emojis.";

        com.fasterxml.jackson.databind.JsonNode json = groq.chatJson(prompt, context.toString());

        RepoDeepDiveResponse response = new RepoDeepDiveResponse();
        response.setSummary(json.path("summary").asText(""));
        response.setArchitectureAndStack(json.path("architectureAndStack").asText(""));
        response.setCodeStructureFeedback(json.path("codeStructureFeedback").asText(""));
        response.setCommitQualityFeedback(json.path("commitQualityFeedback").asText(""));

        List<String> improvements = new ArrayList<>();
        json.path("actionableImprovements").forEach(n -> improvements.add(n.asText()));
        response.setActionableImprovements(improvements);

        return response;
    }

    private String getTonePrompt(String tone) {
        return switch (tone == null ? "honest" : tone.toLowerCase(java.util.Locale.ROOT)) {
            case "gordon" -> "You are Gordon Ramsay. You are extremely angry, aggressive, and disappointed. Use his signature style and catchphrases.";
            case "parent" -> "You are a disappointed parent. You aren't mad, you're just disappointed. Use passive-aggressive guilt trips.";
            case "techbro" -> "You are an insufferable Silicon Valley tech bro. Use excessive buzzwords, talk about synergy, disruption, and 10x engineering.";
            case "honest" -> "You are brutally honest. Do not hold back, but be professional about your criticism.";
            default -> "You are a witty, slightly sarcastic code reviewer.";
        };
    }

    public CommitShameResponse shameCommits(List<String> commits, String tone) {
        StringBuilder context = new StringBuilder();
        context.append("--- RECENT COMMITS ---\n");
        for (int i = 0; i < commits.size(); i++) {
            context.append(i+1).append(". ").append(commits.get(i).replace("\n", " ")).append("\n");
        }

        String prompt = getTonePrompt(tone) + "\n\n" +
            "Analyze these recent git commit messages.\n" +
            "Respond with valid JSON matching exactly this shape:\n" +
            "{\n" +
            "  \"summary\": \"A short 1-sentence summary of their commit habits.\",\n" +
            "  \"lazinessScore\": Integer from 0 to 100 (100 = completely lazy/useless messages),\n" +
            "  \"worstCommits\": [\"The 3 most offending/useless commit messages\"],\n" +
            "  \"roast\": \"A paragraph roasting them based on their commit messages.\"\n" +
            "}";

        com.fasterxml.jackson.databind.JsonNode json = groq.chatJson(prompt, context.toString());
        CommitShameResponse res = new CommitShameResponse();
        res.setSummary(json.path("summary").asText(""));
        res.setLazinessScore(clamp(json.path("lazinessScore").asInt(0)));
        List<String> worst = new ArrayList<>();
        json.path("worstCommits").forEach(n -> worst.add(n.asText()));
        res.setWorstCommits(worst);
        res.setRoast(json.path("roast").asText(""));
        return res;
    }

    public ReadmeRaterResponse rateReadmes(Map<String, String> readmes, String tone) {
        StringBuilder context = new StringBuilder();
        appendReadmeSnippets(context, readmes);

        String prompt = getTonePrompt(tone) + "\n\n" +
            "Analyze these README excerpts from a developer's repositories.\n" +
            "Respond with valid JSON matching exactly this shape:\n" +
            "{\n" +
            "  \"summary\": \"A short 1-sentence summary of their documentation skills.\",\n" +
            "  \"uselessnessScore\": Integer from 0 to 100 (100 = completely useless/empty readmes),\n" +
            "  \"nitpicks\": [\"2 or 3 specific things they did wrong\"],\n" +
            "  \"roast\": \"A paragraph roasting their lack of documentation.\",\n" +
            "  \"generatedReadme\": \"A full, valid Markdown template for a much better, slightly passive-aggressive README that fixes their mistakes.\"\n" +
            "}";

        com.fasterxml.jackson.databind.JsonNode json = groq.chatJson(prompt, context.toString());
        ReadmeRaterResponse res = new ReadmeRaterResponse();
        res.setSummary(json.path("summary").asText(""));
        res.setUselessnessScore(clamp(json.path("uselessnessScore").asInt(0)));
        List<String> nitpicks = new ArrayList<>();
        json.path("nitpicks").forEach(n -> nitpicks.add(n.asText()));
        res.setNitpicks(nitpicks);
        res.setRoast(json.path("roast").asText(""));
        res.setGeneratedReadme(json.path("generatedReadme").asText(""));
        return res;
    }

    public StackRoastResponse roastStack(Map<String, Integer> languages, Map<String, String> configs, String tone) {
        StringBuilder context = new StringBuilder();
        context.append("--- LANGUAGES (Repo counts) ---\n");
        Optional.ofNullable(languages).orElse(Map.of()).forEach((k,v) -> context.append(k).append(": ").append(v).append("\n"));
        context.append("\n--- CONFIG FILES ---\n");
        for (Map.Entry<String, String> entry : configs.entrySet()) {
            context.append("[").append(entry.getKey()).append("]\n");
            String content = entry.getValue();
            context.append(content.length() > 500 ? content.substring(0, 500) + "..." : content).append("\n\n");
        }

        String prompt = getTonePrompt(tone) + "\n\n" +
            "Analyze this developer's programming languages and configuration files.\n" +
            "Respond with valid JSON matching exactly this shape:\n" +
            "{\n" +
            "  \"topLanguagesRoast\": \"A paragraph roasting their choice of top programming languages.\",\n" +
            "  \"configDeepDiveRoast\": \"A paragraph roasting their dependencies and tech stack found in their config files.\",\n" +
            "  \"overallVerdict\": \"A 1-sentence final judgment of their stack.\"\n" +
            "}";

        com.fasterxml.jackson.databind.JsonNode json = groq.chatJson(prompt, context.toString());
        StackRoastResponse res = new StackRoastResponse();
        res.setTopLanguagesRoast(json.path("topLanguagesRoast").asText(""));
        res.setConfigDeepDiveRoast(json.path("configDeepDiveRoast").asText(""));
        res.setOverallVerdict(json.path("overallVerdict").asText(""));
        return res;
    }
}
