import { useState, useEffect } from 'react';
import headlessProjects from '../config/headless-config.json';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Server, PlayCircle, CheckCircle, XCircle, FileJson, Trash2, Search, RefreshCw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Navbar from '@/components/Navbar';
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Result {
  email: string;
  status: 'Success' | 'Failed';
  message: string;
  fullResponse: object;
}

interface Member {
    id: string;
    loginEmail: string;
    contactId: string;
    profile: {
        nickname: string;
    };
}

interface SenderDetails {
    fromName: string;
    fromEmail: string;
}

export function HeadlessImportPage() {
  const [selectedProject, setSelectedProject] = useState(headlessProjects[0]);
  const [emails, setEmails] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  
  const [senderDetails, setSenderDetails] = useState<SenderDetails | null>(null);
  const [isFetchingSender, setIsFetchingSender] = useState(false);
  const [isUpdatingSender, setIsUpdatingSender] = useState(false);

  const fetchSenderDetails = async (siteId: string) => {
    setIsFetchingSender(true);
    try {
        const response = await fetch('/api/headless-sender-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteId }),
        });
        if (!response.ok) throw new Error('Failed to fetch sender details.');
        const data = await response.json();
        setSenderDetails(data.senderDetails);
    } catch (error) {
        toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
        setSenderDetails(null);
    } finally {
        setIsFetchingSender(false);
    }
  };
  
  const handleUpdateSenderName = async () => {
    if (!senderDetails) return;
    setIsUpdatingSender(true);
    try {
        const response = await fetch('/api/headless-sender-details', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                siteId: selectedProject.siteId,
                senderDetails: {
                    fromName: senderDetails.fromName,
                    fromEmail: senderDetails.fromEmail
                }
            }),
        });
        if (!response.ok) throw new Error('Failed to update sender name.');
        const data = await response.json();
        toast({ title: "Success", description: data.verificationNeeded ? "Sender name updated. Verification may be needed." : "Sender name updated successfully." });
    } catch (error) {
        toast({ title: "Update Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsUpdatingSender(false);
    }
  };

  useEffect(() => {
    if (selectedProject) {
        fetchSenderDetails(selectedProject.siteId);
    }
  }, [selectedProject]);

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
      const requestBody = { email: email.trim(), siteId: selectedProject.siteId };
      try {
        const response = await fetch('/api/headless-register', {
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
        const errorResponse = { error: 'Network error or issue with local server.', details: (error as Error).toString() };
        setResults(prev => [...prev, { email, status: 'Failed', message: 'Network error connecting to local server.', fullResponse: errorResponse }]);
      }
    }
    setIsLoading(false);
  };

  const handleSearch = async () => {
      if (!searchQuery) {
        toast({ title: "Search query is empty", variant: "destructive" });
        return;
      }
      setIsSearching(true);
      setSearchResults([]);
      setSelectedMembers([]);
      try {
          const response = await fetch('/api/headless-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: searchQuery, siteId: selectedProject.siteId }),
          });
          if (!response.ok) throw new Error(`Error: ${response.statusText}`);
          const data = await response.json();
          setSearchResults(data.members || []);
      } catch (error) {
          toast({ title: "Search failed", description: (error as Error).message, variant: "destructive" });
      } finally {
          setIsSearching(false);
      }
  };

  const handleDelete = async () => {
    if (selectedMembers.length === 0) {
        toast({ title: "No members selected", variant: "destructive" });
        return;
    }
    setIsDeleting(true);
    try {
        const response = await fetch('/api/headless-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberIds: selectedMembers, siteId: selectedProject.siteId }),
        });
        if (!response.ok) throw new Error(`Error: ${response.statusText}`);
        toast({ title: "Members deleted successfully" });
        setSearchResults(searchResults.filter(member => !selectedMembers.includes(member.id)));
        setSelectedMembers([]);
    } catch (error) {
        toast({ title: "Deletion failed", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsDeleting(false);
    }
  };

  const emailCount = emails.split(/[,\s\n]+/).filter(e => e.trim().includes('@')).length;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-4">
                <Server className="h-10 w-10 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold">Headless Member Import</h1>
                  <p className="text-muted-foreground">Bulk register new members to a Wix Headless project.</p>
                </div>
            </div>
            <div className="flex gap-2">
                <Input
                    placeholder="Enter email to search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                    className="w-64"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                    <Search className="mr-2 h-4 w-4" />
                    {isSearching ? 'Searching...' : 'Search'}
                </Button>
            </div>
          </div>
          
          {(isSearching || searchResults.length > 0) && (
            <Card className="bg-gradient-card shadow-card border-primary/10">
                <CardHeader>
                    <CardTitle>Search Results</CardTitle>
                    <CardDescription>Found {searchResults.length} member(s). Select members to delete.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={searchResults.length > 0 && selectedMembers.length === searchResults.length}
                                            onCheckedChange={(checked) => {
                                                const allMemberIds = checked ? searchResults.map(m => m.id) : [];
                                                setSelectedMembers(allMemberIds);
                                            }}
                                        />
                                    </TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {searchResults.map(member => (
                                    <TableRow key={member.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedMembers.includes(member.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedMembers(prev =>
                                                        checked ? [...prev, member.id] : prev.filter(id => id !== member.id)
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{member.profile?.nickname || 'N/A'}</TableCell>
                                        <TableCell>{member.loginEmail}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                {selectedMembers.length > 0 && (
                    <CardFooter>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeleting}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {isDeleting ? 'Deleting...' : `Delete (${selectedMembers.length}) Selected`}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete the selected {selectedMembers.length} member(s). This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, Delete Members</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardFooter>
                )}
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-gradient-card shadow-card border-primary/10 h-full">
              <CardHeader>
                <CardTitle>1. Select Headless Project</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedProject.siteId}
                  onValueChange={(siteId) => {
                    const project = headlessProjects.find(p => p.siteId === siteId);
                    if (project) setSelectedProject(project);
                  }}
                >
                  <SelectTrigger>
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
            <Card className="bg-gradient-card shadow-card border-primary/10 h-full">
                <CardHeader>
                    <CardTitle>Sender Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="Loading sender name..."
                            value={senderDetails?.fromName || ''}
                            onChange={(e) => setSenderDetails(prev => prev ? { ...prev, fromName: e.target.value } : null)}
                            disabled={isFetchingSender || isUpdatingSender}
                        />
                        <Button onClick={handleUpdateSenderName} disabled={isUpdatingSender || !senderDetails} size="icon">
                            <Save className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => fetchSenderDetails(selectedProject.siteId)} disabled={isFetchingSender} variant="outline" size="icon">
                            <RefreshCw className={`h-4 w-4 ${isFetchingSender ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                     {senderDetails && <p className="text-xs text-muted-foreground mt-2">Sender Email: {senderDetails.fromEmail}</p>}
                </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-card shadow-card border-primary/10">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>2. Add Member Emails for Import</CardTitle>
                  <CardDescription>Enter one email per line or separate with commas/spaces.</CardDescription>
                </div>
                <Badge variant="secondary">{emailCount} email(s)</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="user1@example.com
user2@example.com"
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