import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { FileText, Link, Upload, Youtube, Loader2 } from "lucide-react";

export default function Summarizer() {
  const [inputText, setInputText] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("text");
  const { toast } = useToast();

  const handleSummarize = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Input required",
        description: "Please enter text or URL to summarize",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('POST', '/api/summarize/text', {
        text: inputText
      }, false);
      
      const data = await response.json();
      setSummary(data.summary);
      
      toast({
        title: "Summary generated!",
        description: "Your content has been successfully summarized"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInputText("");
    setSummary("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            AI Article Summarizer
          </h1>
          <p className="text-lg text-muted-foreground">
            Get concise summaries of articles, PDFs, and YouTube videos using advanced AI
          </p>
        </div>

        <Card className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="text" data-testid="tab-text">
                <FileText className="w-4 h-4 mr-2" />
                Text
              </TabsTrigger>
              <TabsTrigger value="url" data-testid="tab-url">
                <Link className="w-4 h-4 mr-2" />
                URL
              </TabsTrigger>
              <TabsTrigger value="pdf" data-testid="tab-pdf">
                <Upload className="w-4 h-4 mr-2" />
                PDF
              </TabsTrigger>
              <TabsTrigger value="youtube" data-testid="tab-youtube">
                <Youtube className="w-4 h-4 mr-2" />
                YouTube
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="text" className="space-y-4">
                <div>
                  <Label htmlFor="text-input">Enter text to summarize</Label>
                  <Textarea
                    id="text-input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your article text here..."
                    className="min-h-[300px] resize-none mt-2"
                    data-testid="input-text-summarize"
                  />
                </div>
              </TabsContent>

              <TabsContent value="url" className="space-y-4">
                <div>
                  <Label htmlFor="url-input">Enter article URL</Label>
                  <Textarea
                    id="url-input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="https://example.com/article"
                    className="min-h-[150px] resize-none mt-2"
                    data-testid="input-url-summarize"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Note: URL content extraction is coming soon. For now, please copy and paste the article text.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="pdf" className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                  <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">PDF Upload Coming Soon</h3>
                  <p className="text-muted-foreground">
                    For now, please copy and paste the PDF text content in the Text tab.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="youtube" className="space-y-4">
                <div>
                  <Label htmlFor="youtube-input">Enter YouTube video URL</Label>
                  <Textarea
                    id="youtube-input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="min-h-[150px] resize-none mt-2"
                    data-testid="input-youtube-summarize"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Note: YouTube transcript extraction is coming soon. For now, please provide the video transcript text.
                  </p>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              onClick={handleReset}
              data-testid="button-reset-summarizer"
            >
              Reset
            </Button>
            <Button
              onClick={handleSummarize}
              disabled={loading || !inputText.trim()}
              data-testid="button-generate-summary"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Summary'
              )}
            </Button>
          </div>
        </Card>

        {summary && (
          <Card className="p-6 mt-6" data-testid="summary-result">
            <h2 className="text-xl font-semibold mb-4">Summary:</h2>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {summary}
              </p>
            </div>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  );
}
