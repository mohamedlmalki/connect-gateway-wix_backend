import { useState } from 'react';
import headlessProjects from '../config/headless-config.json';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Server, PlayCircle, CheckCircle, XCircle, FileJson } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Navbar from '@/components/Navbar';

interface Result {
  email: string;
  status: 'Success' | 'Failed';
  message: string;
  fullResponse: object;
}

export function HeadlessImportPage() {
  const [selectedProject, setSelectedProject] = useState(headlessProjects[0]);
  const [emails, setEmails] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleImport = async () => {
    setResults([]);
    setIsLoading(true);

    const emailList = emails.split(/[,\s\n]+/).map(email => email.trim()).filter(email => email.includes('@'));

    if (emailList.length === 0) {
      alert('Please enter at least one valid email address.');
      setIsLoading(false);
      return;
    }

    for (const email of emailList) {
      const localApiUrl = '/api/headless-register';
      const requestBody = { email: email.trim(), siteId: selectedProject.siteId };

      try {
        const response = await fetch(localApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        const responseData = await response.json();

        if (response.ok && (responseData.state === 'SUCCESS' || responseData.state === 'REQUIRE_EMAIL_VERIFICATION')) {
          const successMessage = responseData.state === 'SUCCESS' ? 'Member registered instantly.' : 'Success (Email verification sent).';
          setResults(prev => [...prev, { email, status: 'Success', message: successMessage, fullResponse: responseData }]);
        } else {
          const errorMessage = responseData.message || 'Registration failed.';
          setResults(prev => [...prev, { email, status: 'Failed', message: errorMessage, fullResponse: responseData }]);
        }
      } catch (error) {
        const errorResponse = { error: 'Network error or issue with local server.', details: error.toString() };
        setResults(prev => [...prev, { email, status: 'Failed', message: 'Network error connecting to local server.', fullResponse: errorResponse }]);
      }
    }
    setIsLoading(false);
  };

  const emailCount = emails.split(/[,\s\n]+/).filter(e => e.trim().includes('@')).length;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4 animate-fade-in">
            <Server className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Headless Member Import</h1>
              <p className="text-muted-foreground">Bulk register new members to a Wix Headless project.</p>
            </div>
          </div>

          <Card className="bg-gradient-card shadow-card border-primary/10">
            <CardHeader>
              <CardTitle>1. Select Headless Project</CardTitle>
              <CardDescription>Choose which headless project you want to import members into.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedProject.siteId}
                onValueChange={(siteId) => {
                  const project = headlessProjects.find(p => p.siteId === siteId);
                  if (project) setSelectedProject(project);
                }}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {headlessProjects.map(project => (
                    <SelectItem key={project.siteId} value={project.siteId}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-primary/10">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>2. Add Member Emails</CardTitle>
                  <CardDescription>Enter one email per line or separate with commas/spaces.</CardDescription>
                </div>
                <Badge variant="secondary">{emailCount} email(s)</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="user1@example.com&#10;user2@example.com"
                className="h-48 resize-y font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card className="bg-gradient-primary text-primary-foreground shadow-glow">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Ready to Import?</h3>
                <p className="text-primary-foreground/80">Start the import job for the selected project.</p>
              </div>
              <Button
                onClick={handleImport}
                disabled={isLoading || emailCount === 0}
                className="w-48 bg-white text-primary hover:bg-white/90"
                size="lg"
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                {isLoading ? 'Importing...' : 'Start Import'}
              </Button>
            </CardContent>
          </Card>

          {results.length > 0 && (
            <Card className="bg-gradient-card shadow-card border-primary/10">
              <CardHeader>
                <CardTitle>Import Results</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Full Response</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">{result.email}</TableCell>
                        <TableCell>
                          {result.status === 'Success' ? (
                            <span className="flex items-center gap-2 text-green-500"><CheckCircle className="h-4 w-4" /> Success</span>
                          ) : (
                            <span className="flex items-center gap-2 text-red-500"><XCircle className="h-4 w-4" /> Failed</span>
                          )}
                        </TableCell>
                        <TableCell>{result.message}</TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                <FileJson className="h-4 w-4" /> View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                              <DialogHeader>
                                <DialogTitle>Full API Response for: {result.email}</DialogTitle>
                              </DialogHeader>
                              <div className="flex-grow overflow-y-auto">
                                <pre className="w-full rounded-md bg-slate-950 p-4 text-white text-xs">
                                  <code>{JSON.stringify(result.fullResponse, null, 2)}</code>
                                </pre>
                              </div>
                              <DialogClose asChild>
                                <Button type="button" className="mt-4">Close</Button>
                              </DialogClose>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}