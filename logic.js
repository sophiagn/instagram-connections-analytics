const { createApp } = Vue;

createApp({
    data() {
        return {
            followers: null,
            following: null,
            followersFiles: [],
            followersFileNames: [],
            followingFile: null,
            followingFileName: "",
            draggingTarget: null,
            showHelp: false,
            isProcessing: false,
            processErrorMessage: "",
        };
    },

    computed: {
        canProcessData() {
            return Boolean(this.followersFiles.length > 0 && this.followingFile);
        },

        loaded() {
            return Array.isArray(this.followers) && Array.isArray(this.following);
        },

        notFollowedBack() {
            const followers = this.followers || [];
            const following = this.following || [];
            const followerUsernames = new Set(followers.map((user) => user.username));
            return following.filter(
                (user) => !followerUsernames.has(user.username)
            );
        }
    },

    methods: {
        handleFileUpload(event, type) {
            const files = Array.from(event.target.files);
            files.forEach(file => {
                this.storeSelectedFile(file, type);
            });
        },

        triggerFileInput(type) {
            const uploadBlocks = document.querySelectorAll('.upload-block');
            const blockIndex = type === "followers" ? 0 : 1;
            const input = uploadBlocks[blockIndex].querySelector('input[type="file"]');
            if (input) input.click();
        },

        storeSelectedFile(file, type) {
            if (!file) return;

            const isJsonFile =
                file.type === "application/json" || file.name.toLowerCase().endsWith(".json");

            if (!isJsonFile) {
                this.processErrorMessage = `Uploaded files must be in .json format.`;
                console.error("Unable to process uploaded files: non-JSON file uploaded");
                return;
            }

            this.processErrorMessage = "";

            if (type === "followers") {
                if (!this.followersFiles.some(f => f.name === file.name)) {
                    this.followersFiles.push(file);
                    this.followersFileNames.push(file.name);
                    this.followers = null;
                }
                return;
            }

            this.followingFile = file;
            this.followingFileName = file.name;
            this.following = null;
        },

        async processData() {
            if (!this.canProcessData || this.isProcessing) return;

            this.isProcessing = true;

            try {
                const followerPromises = this.followersFiles.map(file =>
                    this.parseUsersFromFile(file, "followers")
                );
                const allFollowersArrays = await Promise.all(followerPromises);
                const followers = allFollowersArrays.flat();
                
                const following = await this.parseUsersFromFile(this.followingFile, "following");
                
                this.followers = followers;
                this.following = following;
                this.processErrorMessage = "";
            } catch (error) {
                this.followers = null;
                this.following = null;
                this.processErrorMessage = "Unable to process uploaded files.";
                console.error(this.processErrorMessage, error);
            } finally {
                this.isProcessing = false;
            }
        },

        parseUsernameFromHref(href) {
            if (!href || typeof href !== "string") return "";
            try {
                const { pathname } = new URL(href);
                const segments = pathname.split("/").filter(Boolean);
                const candidate = segments[segments.length - 1];
                if (!candidate || candidate === "_u") return "";
                return candidate;
            } catch {
                return "";
            }
        },

        extractUsers(entries) {
            if (!Array.isArray(entries)) return [];

            return entries
                .map((entry) => {
                    const href = entry?.string_list_data?.[0]?.href || "";
                    const username = this.parseUsernameFromHref(href);
                    if (!href || !username) return null;
                    return { username, href };
                })
                .filter(Boolean);
        },

        async parseUsersFromFile(file, type) {
            const text = await file.text();
            const data = JSON.parse(text);

            let entries = [];

            if (Array.isArray(data)) {
                entries = data;
            } else if (type === "followers") {
                entries = data.followers || data.relationships_followers || [];
            } else {
                entries = data.following || data.relationships_following || [];
            }

            return this.extractUsers(entries);
        },

        handleDragOver(type) {
            this.draggingTarget = type;
        },

        handleDragLeave(type) {
            if (this.draggingTarget === type) {
                this.draggingTarget = null;
            }
        },

        handleDrop(event, type) {
            this.draggingTarget = null;
            const files = Array.from(event.dataTransfer.files);
            files.forEach(file => {
                this.storeSelectedFile(file, type);
            });
        },

        removeUploadedFile(type, index) {
            if (type === "followers") {
                this.followersFiles.splice(index, 1);
                this.followersFileNames.splice(index, 1);
                this.followers = null;
            } else {
                this.followingFile = null;
                this.followingFileName = "";
            }
        }
    }
}).mount("#app");