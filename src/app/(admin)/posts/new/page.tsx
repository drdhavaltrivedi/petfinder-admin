"use client";

import { useRouter } from "next/navigation";
import PostForm from "@/components/PostForm";
import { createPost, describeError, uploadPostImage } from "@/lib/posts";

export default function NewPostPage() {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Create post</h1>
      <PostForm
        imageRequired
        submitLabel="Publish post"
        busyLabel="Publishing…"
        cancelHref="/posts"
        onSubmit={async ({ caption, category, file }) => {
          if (!file) throw new Error("Please choose an image.");
          let url: string;
          try {
            url = await uploadPostImage(file);
          } catch (e) {
            throw new Error(describeError("Image upload failed", e));
          }
          try {
            const ref = await createPost({ caption, category }, url);
            router.replace(`/posts/${ref.id}`);
          } catch (e) {
            throw new Error(describeError("Saving the post failed (the image was uploaded)", e));
          }
        }}
      />
    </div>
  );
}
